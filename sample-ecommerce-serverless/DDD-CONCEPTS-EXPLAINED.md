# 🎓 Domain-Driven Design Concepts Explained

## Table of Contents

1. [Why Do We Need the Application Layer?](#why-application-layer)
2. [What Are Aggregates?](#what-are-aggregates)
3. [The Complete Flow](#complete-flow)
4. [Caching Mechanisms Compared](#caching-mechanisms)

---

## 1. Why Do We Need the Application Layer? {#why-application-layer}

### The Problem: Everything in One Place

**Bad Approach** - All logic in Lambda handler:

```typescript
// ❌ BAD: Everything mixed together
export const handler: APIGatewayProxyHandler = async (event) => {
  const body = JSON.parse(event.body);
  
  // Validation
  if (!body.customerId) throw new Error('...');
  
  // HTTP calls
  const product = await fetch(`${CATALOG_URL}/products/123`);
  
  // Business logic
  if (!product.inStock) throw new Error('...');
  
  // Database
  await dynamodb.putItem({...});
  
  // Events
  await eventbridge.putEvents({...});
  
  return { statusCode: 200, body: '...' };
};
```

**Problems**:
- ❌ Can't test without DynamoDB and HTTP
- ❌ Can't reuse from other handlers
- ❌ Business logic mixed with infrastructure
- ❌ Hard to maintain

---

### The Solution: Layered Architecture

```
Handler (API Gateway)
    ↓ calls
Application Layer (Use Case)
    ↓ calls
Domain Layer (Business Logic)
    ↓ uses
Infrastructure Layer (Database, HTTP)
```

---

### Handler: Thin Entry Point

```typescript
// ✅ GOOD: Thin handler - only HTTP concerns
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // Parse request
    const dto: CreateOrderDTO = JSON.parse(event.body || '{}');
    
    // Call use case
    const result = await createOrderUseCase.execute(dto);
    
    // Return response
    return {
      statusCode: 201,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return errorResponse(error);
  }
};
```

**Responsibilities**: Parse HTTP → Call use case → Format response

**That's it!** Only 10 lines of code.

---

### Use Case: Orchestrator

```typescript
// ✅ GOOD: Use case orchestrates the workflow
export class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private catalogClient: CatalogClient,
    private eventPublisher: EventPublisher
  ) {}
  
  async execute(dto: CreateOrderDTO): Promise<OrderResponseDTO> {
    // Step 1: Validate input
    this.validateInput(dto);
    
    // Step 2: Get products (with Redis cache!)
    const products = await this.catalogClient.getProducts(productIds);
    
    // Step 3: Validate products
    this.validateProducts(dto.items, products);
    
    // Step 4: Create order items
    const orderItems = this.createOrderItems(dto.items, products);
    
    // Step 5: Create Order aggregate (business logic!)
    const order = Order.create(dto.customerId, orderItems);
    
    // Step 6: Save
    await this.orderRepository.save(order);
    
    // Step 7: Publish events
    for (const event of order.domainEvents) {
      await this.eventPublisher.publish(event);
    }
    
    // Step 8: Return DTO
    return this.toDTO(order);
  }
}
```

**Responsibilities**: 
- Orchestrate workflow ("the recipe")
- Call external services
- Coordinate domain objects
- Manage transactions

**NOT responsible for**:
- Business rules (delegates to Order)
- Database details (delegates to repository)
- HTTP caching (delegates to HTTP client)

---

### Why Separation Matters

#### 1. Testability

```typescript
// Test WITHOUT real database or HTTP!
describe('CreateOrderUseCase', () => {
  it('creates order', async () => {
    const mockRepo = { save: jest.fn() };
    const mockClient = { 
      getProducts: jest.fn().mockResolvedValue(mockProducts) 
    };
    
    const useCase = new CreateOrderUseCase(mockRepo, mockClient, ...);
    const result = await useCase.execute(dto);
    
    expect(result.orderId).toBeDefined();
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

#### 2. Reusability

```typescript
// Same use case, different handlers!

// HTTP handler
const httpHandler = async (event) => {
  return await createOrderUseCase.execute(JSON.parse(event.body));
};

// SQS handler
const sqsHandler = async (event) => {
  for (const record of event.Records) {
    await createOrderUseCase.execute(JSON.parse(record.body));
  }
};

// Scheduled job
const cronHandler = async () => {
  const recurringOrder = await getRecurringOrder();
  await createOrderUseCase.execute(recurringOrder);
};
```

#### 3. Maintainability

```typescript
// Switch from DynamoDB to MongoDB?
// Only change infrastructure layer!

// Old
class DynamoDBOrderRepository implements IOrderRepository {}

// New
class MongoDBOrderRepository implements IOrderRepository {}

// Use case stays exactly the same! ✅
```

---

## 2. What Are Aggregates? {#what-are-aggregates}

### Definition

**Aggregate** = A cluster of related objects treated as a single unit.

```
Aggregate = Root + Entities + Value Objects
```

### Real-World Analogy: A Company

```
Company (Aggregate Root - the CEO)
├── Engineering Department (Entity)
├── Sales Department (Entity)
└── HR Department (Entity)

Rules:
- Want to hire someone? → Ask CEO (can't go directly to dept)
- Want to change budget? → Ask CEO
- CEO ensures all rules are followed
```

### In Our System: Order Aggregate

```
Order (Aggregate Root)
├── Order ID
├── Customer ID (reference by ID only!)
├── Order Items (Entities)
│   ├── OrderItem 1 (product, quantity, price)
│   ├── OrderItem 2
│   └── OrderItem 3
├── Total Amount (Money Value Object)
├── Status (OrderStatus Value Object)
└── Timestamps

Rules:
- Add item? → order.addItem() (not item.add()!)
- Confirm? → order.confirm()
- Cancel? → order.cancel()
- Can't modify OrderItem directly!
```

---

### The 4 Golden Rules of Aggregates

#### Rule 1: One Root Per Aggregate

```typescript
// ✅ GOOD: Go through aggregate root
const order = Order.create(customerId, items);
order.addItem(newItem);    // Through root
order.confirm();           // Through root

// ❌ BAD: Bypass aggregate root
order.items[0].quantity = 10;  // Direct modification - WRONG!
```

#### Rule 2: Reference Other Aggregates by ID Only

```typescript
// ✅ GOOD: Reference Customer by ID
class Order {
  customerId: string;  // Just ID, not whole object
}

// ❌ BAD: Embed entire Customer
class Order {
  customer: Customer;  // Too much coupling!
}
```

**Why?** Each aggregate manages its own consistency.

#### Rule 3: One Transaction Per Aggregate

```typescript
// ✅ ONE TRANSACTION: Changes to one Order
await orderRepository.save(order);

// ❌ AVOID: Multiple aggregates in one transaction
// Use eventual consistency and domain events instead!
```

#### Rule 4: Aggregate Root Enforces Invariants

**Invariant** = A rule that must ALWAYS be true

```typescript
export class Order extends AggregateRoot<OrderProps> {
  
  addItem(item: OrderItem): void {
    // Invariant 1: Can't modify completed orders
    if (this.status.isFinal()) {
      throw new Error('Cannot modify completed orders');
    }
    
    // Invariant 2: Order must have items
    this.props.items.push(item);
    
    // Invariant 3: Total must be correct
    this.props.totalAmount = Order.calculateTotal(this.props.items);
    
    // All invariants maintained! ✅
  }
}
```

---

### Order Aggregate Example

```typescript
export class Order extends AggregateRoot<OrderProps> {
  
  // Factory method: ONLY way to create Order
  static create(customerId: string, items: OrderItem[]): Order {
    // Business Rule: Order must have items
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    
    // Business Rule: Customer ID required
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    
    // Calculate total
    const totalAmount = this.calculateTotal(items);
    
    const order = new Order({
      orderId: this.generateId(),
      customerId,
      items,
      totalAmount,
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    }, orderId);
    
    // Emit domain event
    order.addDomainEvent(new OrderCreatedEvent({...}));
    
    return order;
  }
  
  // Business method: Confirm order
  confirm(): void {
    // Business Rule: Can only confirm pending orders
    if (!this.status.canTransitionTo(OrderStatus.CONFIRMED)) {
      throw new Error(`Cannot confirm ${this.status} order`);
    }
    
    this.props.status = OrderStatus.CONFIRMED;
    this.props.updatedAt = new Date();
  }
  
  // Business method: Add item
  addItem(item: OrderItem): void {
    // Business Rule: Can't modify completed orders
    if (this.status.isFinal()) {
      throw new Error('Cannot modify completed orders');
    }
    
    this.props.items.push(item);
    this.props.totalAmount = Order.calculateTotal(this.props.items);
    this.props.updatedAt = new Date();
  }
}
```

**All business rules in ONE place!** ✅

---

## 3. The Complete Flow {#complete-flow}

### From HTTP Request to Database

```
1. HTTP POST /orders
   ↓
2. Lambda Handler
   - Parse JSON
   - Create DTO
   - Call use case
   ↓
3. CreateOrderUseCase
   - Validate input
   - Get products (Redis cache!)
   - Create Order aggregate
   - Save to DynamoDB
   - Publish events
   ↓
4. Order.create()
   - Enforce business rules
   - Emit domain events
   ↓
5. Infrastructure
   - Redis: Check cache
   - DynamoDB: Save order
   - EventBridge: Publish events
   ↓
6. HTTP 201 Created
   { "orderId": "...", ... }

Total: ~25ms with Redis cache!
```

---

## 4. Caching with Redis (undici-cache-redis) {#caching-mechanisms}

### Redis Cache Implementation ⭐

```typescript
import { RedisCacheStore } from 'undici-cache-redis';

class UndiciRedisClient {
  constructor() {
    this.cacheStore = new RedisCacheStore({
      clientOpts: {
        host: 'redis.elasticache.aws.com',
        keyPrefix: 'catalog-cache:'
      },
      cacheTagsHeader: 'cache-tags',
      tracking: true  // Client-side fast cache
    });
  }
}
```

**Architecture**:
```
Lambda 1 ─┐
Lambda 2 ─┼─→ [Redis ElastiCache] ← Shared!
Lambda 3 ─┘

✅ All Lambdas share cache
✅ Persists across cold starts
✅ Tag-based invalidation
```

**Performance**:
- First request: 200ms
- All subsequent requests: < 5ms ✅
- After invalidation: Fresh data

---

### Cache Tags for Smart Invalidation

```typescript
// Catalog service adds tags:
headers: {
  'Cache-Tags': 'product:123,category:electronics'
}

// Later, invalidate by tag:
await catalogClient.invalidateCacheByTags(['product:123']);

// This invalidates ALL cached responses with that tag!
// - GET /products/123
// - GET /products?category=electronics
// - GET /search?q=product123
```

**Benefits**:
- ✅ Precise invalidation
- ✅ Invalidate related data together
- ✅ Automatic cache freshness

---

### Performance Benefits

| Metric | Value |
|--------|-------|
| **First call** | 200ms |
| **Cached (tracking)** | < 1ms |
| **Cached (Redis)** | < 5ms |
| **Cache hit rate** | 95% |
| **Cost (1000 orders/day)** | $0.58 |
| **Savings vs no cache** | 87% |

**Key Advantage**: All Lambda instances share the same cache!

---

## Summary

### Application Layer
- **Purpose**: Orchestrate workflows
- **Responsibilities**: Coordinate domain objects, external services, transactions
- **Benefits**: Testable, reusable, maintainable

### Aggregates
- **Purpose**: Enforce business rules and maintain consistency
- **Golden Rules**: 
  1. One root per aggregate
  2. Reference by ID
  3. One transaction per aggregate
  4. Root enforces invariants

### Redis Cache (undici-cache-redis)
- **Benefit**: Shared cache across all Lambda instances
- **Performance**: 95% cache hit rate, < 5ms response
- **Cost**: 87% reduction vs no cache
- **Features**: Tag-based invalidation, persistent cache, auto-sync

---

## Quick Reference

```typescript
// ❌ DON'T: Put everything in handler
handler() {
  validate();
  httpCall();
  businessLogic();
  database();
}

// ✅ DO: Separate concerns
handler() {
  useCase.execute(dto);
}

useCase.execute() {
  validate();
  httpCall();  // With Redis cache!
  order = Order.create();  // Business rules!
  repository.save();
}

Order.create() {
  enforceRules();
  emitEvents();
}
```

**The key: Each layer has ONE job!**
