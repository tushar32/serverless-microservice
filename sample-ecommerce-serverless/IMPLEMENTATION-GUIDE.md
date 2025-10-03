# Implementation Guide: DDD Serverless Microservices

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Domain-Driven Design Patterns](#domain-driven-design-patterns)
3. [Project Structure Explained](#project-structure-explained)
4. [Key Implementations](#key-implementations)
5. [Communication Patterns](#communication-patterns)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Guide](#deployment-guide)
8. [Best Practices](#best-practices)

---

## Architecture Overview

### Bounded Contexts

The project implements **3 bounded contexts** (microservices):

```
┌─────────────────┐    HTTP (Undici)    ┌─────────────────┐
│  Orders Service │ ─────────────────► │ Catalog Service │
│                 │    with Caching     │                 │
└────────┬────────┘                     └─────────────────┘
         │                                      
         │ EventBridge                          
         │ (Async Events)                       
         ▼                                      
┌─────────────────┐                            
│ Rewards Service │                            
└─────────────────┘                            
```

### Communication Patterns

**Synchronous (Request/Response)**:
- Orders → Catalog: Get product details
- Uses **Undici HTTP client** with caching
- Circuit breaker for resilience
- Exponential backoff retry

**Asynchronous (Event-Driven)**:
- Orders publishes: `order.created`, `order.completed`
- Rewards subscribes: `order.completed` → Issue reward points
- Uses **AWS EventBridge**

---

## Domain-Driven Design Patterns

### 1. Aggregate Root Pattern

**Location**: `services/orders-service/src/domain/models/order.ts`

```typescript
export class Order extends AggregateRoot<OrderProps> {
  // Factory method - only way to create an order
  static create(customerId: string, items: OrderItem[]): Order {
    // Enforce business rules
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    
    const order = new Order({...});
    
    // Add domain event
    order.addDomainEvent(new OrderCreatedEvent({...}));
    
    return order;
  }
  
  // Business logic methods
  confirm(): void { }
  complete(): void { }
  cancel(reason: string): void { }
}
```

**Key Points**:
- ✅ Encapsulates business logic
- ✅ Enforces invariants (rules that must always be true)
- ✅ Emits domain events
- ✅ No public setters - immutability
- ✅ Factory method for creation

### 2. Value Objects

**Location**: `services/orders-service/src/domain/models/value-objects/money.ts`

```typescript
export class Money extends ValueObject<MoneyProps> {
  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    return new Money({ amount, currency });
  }
  
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return Money.create(this.amount + other.amount, this.currency);
  }
}
```

**Key Points**:
- ✅ Immutable
- ✅ Equality by value, not identity
- ✅ Self-validating
- ✅ Rich behavior

### 3. Repository Pattern

**Interface (Domain Layer)**: 
`services/orders-service/src/domain/repositories/order-repository.ts`

```typescript
export interface IOrderRepository {
  save(order: Order): Promise<Order>;
  findById(orderId: string): Promise<Order | null>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}
```

**Implementation (Infrastructure Layer)**: 
`services/orders-service/src/infrastructure/database/dynamodb-order-repository.ts`

```typescript
export class DynamoDBOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<Order> {
    const item = this.toDatabase(order); // Map to DB schema
    await this.docClient.send(new PutCommand({...}));
    return order;
  }
  
  private toDatabase(order: Order): any { /* mapping */ }
  private toDomain(item: any): Order { /* mapping */ }
}
```

**Key Points**:
- ✅ Domain doesn't know about DynamoDB
- ✅ Easy to swap implementations (testing)
- ✅ Dependency Inversion Principle

### 4. Domain Events

**Location**: `services/orders-service/src/domain/events/order-created.event.ts`

```typescript
export class OrderCreatedEvent extends BaseDomainEvent {
  constructor(data: OrderCreatedEventData) {
    super('order.created', data.orderId, data);
  }
}

// Usage in aggregate
const order = Order.create(customerId, items);
order.addDomainEvent(new OrderCreatedEvent({...}));
```

**Publishing**:
```typescript
// After saving
for (const event of order.domainEvents) {
  await eventPublisher.publish(event);
}
order.clearEvents();
```

### 5. Use Cases (Application Services)

**Location**: `services/orders-service/src/application/use-cases/create-order.use-case.ts`

```typescript
export class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private catalogClient: CatalogClient,
    private eventPublisher: EventPublisher
  ) {}
  
  async execute(dto: CreateOrderDTO): Promise<OrderResponseDTO> {
    // 1. Validate input
    // 2. Get product details (external call)
    // 3. Create domain entities
    // 4. Execute business logic
    // 5. Persist
    // 6. Publish events
    // 7. Return DTO
  }
}
```

**Key Points**:
- ✅ Orchestrates the flow
- ✅ Coordinates domain objects
- ✅ Handles external service calls
- ✅ Manages transactions
- ✅ Maps DTOs ↔ Domain models

### 6. Anti-Corruption Layer (ACL)

**Location**: `services/orders-service/src/infrastructure/http/catalog-client.ts`

```typescript
export class CatalogClient {
  async getProduct(productId: string): Promise<ProductInfo> {
    // Call external service
    const response = await this.httpClient.get<CatalogProductResponse>(...);
    
    // Translate to our domain model (ACL)
    return this.translateToOrdersDomain(response);
  }
  
  private translateToOrdersDomain(
    catalogProduct: CatalogProductResponse
  ): ProductInfo {
    return {
      productId: catalogProduct.productId,
      name: catalogProduct.name,
      price: catalogProduct.price,
      // Map only what we need
    };
  }
}
```

**Key Points**:
- ✅ Protects domain from external changes
- ✅ Translates between bounded contexts
- ✅ Only exposes what's needed
- ✅ Independent evolution

---

## Project Structure Explained

### Layered Architecture

```
services/orders-service/src/
│
├── domain/                     # Pure business logic (no dependencies)
│   ├── models/                 # Entities, Aggregates, Value Objects
│   ├── repositories/           # Repository interfaces
│   ├── services/               # Domain services
│   └── events/                 # Domain events
│
├── application/                # Use cases / Application services
│   ├── use-cases/              # Business workflows
│   └── dto/                    # Data Transfer Objects
│
├── infrastructure/             # Technical implementation
│   ├── database/               # Repository implementations
│   ├── http/                   # External API clients (ACL)
│   ├── events/                 # Event publishers
│   └── middleware/             # Cross-cutting concerns
│
└── handlers/                   # Lambda entry points
    ├── api/                    # HTTP handlers
    └── events/                 # Event handlers
```

### Dependency Flow

```
Handlers → Application → Domain
    ↓          ↓
Infrastructure ←────┘

Domain has NO dependencies on other layers!
```

---

## Key Implementations

### 1. HTTP Client with Undici + Caching

**Location**: `shared/http-client/src/undici-client.ts`

**Features**:
- ✅ **Connection pooling** (10 connections)
- ✅ **HTTP caching** (Cache-Control, ETag)
- ✅ **Circuit breaker** (5 failures → OPEN)
- ✅ **Exponential backoff retry** (3 attempts)
- ✅ **Automatic cache invalidation**

**Usage**:
```typescript
const client = new UndiciHttpClient({
  baseUrl: 'https://api.catalog.example.com',
  enableCache: true,
  cacheTTL: 300,  // 5 minutes
  retries: 3
});

// First call → Cache MISS → HTTP request
const product1 = await client.get('/products/123');

// Second call → Cache HIT → No HTTP request!
const product2 = await client.get('/products/123');

// Invalidate cache when product updates
client.invalidateCache('/products/123');
```

**Cache Strategy**:
```
GET /products/123
  ├─ Check cache
  │   └─ HIT → Return cached data
  │   └─ MISS → Make HTTP request
  │       ├─ Success → Cache response (TTL: 5 min)
  │       └─ Failure → Circuit breaker

Cache invalidation triggers:
  - product.updated event received
  - Manual invalidation
  - TTL expired
```

### 2. Event-Driven Communication

**Publishing Events**:

```typescript
// 1. Domain event created in aggregate
const order = Order.create(customerId, items);
// order.domainEvents = [OrderCreatedEvent]

// 2. Published after persistence
await orderRepository.save(order);

for (const event of order.domainEvents) {
  await eventPublisher.publish(event);  // → EventBridge
}

order.clearEvents();
```

**Subscribing to Events**:

```typescript
// EventBridge Rule (CDK)
const rule = new events.Rule(this, 'PaymentCompletedRule', {
  eventPattern: {
    source: ['payment-service'],
    detailType: ['payment.completed']
  }
});

rule.addTarget(new targets.LambdaFunction(paymentCompletedFunction));

// Lambda handler
export const handler: EventBridgeHandler = async (event) => {
  const order = await orderRepository.findById(event.detail.orderId);
  order.complete();  // Domain logic
  await orderRepository.save(order);
};
```

### 3. Circuit Breaker Pattern

**Location**: `shared/http-client/src/circuit-breaker.ts`

**States**:
```
CLOSED → OPEN → HALF_OPEN → CLOSED
  ↓       ↓         ↓
 OK    Failures  Testing
       (≥5)      (1 request)
```

**Implementation**:
```typescript
export class CircuitBreaker {
  canExecute(): boolean {
    if (this.state === OPEN) {
      if (Date.now() - lastFailure > timeout) {
        this.state = HALF_OPEN;  // Try again
        return true;
      }
      return false;  // Stay open
    }
    return true;
  }
  
  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= threshold) {
      this.state = OPEN;  // Circuit opens
    }
  }
}
```

---

## Communication Patterns

### Pattern 1: Synchronous with Caching

**Scenario**: Orders needs product details from Catalog

```typescript
// Orders Service
export class CreateOrderUseCase {
  async execute(dto: CreateOrderDTO) {
    // Call Catalog service via HTTP + Cache
    const products = await this.catalogClient.getProducts(productIds);
    
    // ↑ This uses Undici with caching:
    // - First call: HTTP request (200ms)
    // - Subsequent calls: Cache hit (< 1ms)
    // - Cache TTL: 5 minutes
    // - Auto-invalidate on product.updated event
    
    const orderItems = dto.items.map(item => {
      const product = products.get(item.productId);
      return OrderItem.create(..., Money.create(product.price));
    });
    
    const order = Order.create(dto.customerId, orderItems);
    // ...
  }
}
```

**Flow**:
```
1. Orders receives: POST /orders
2. Orders → Catalog: GET /products?ids=1,2,3 (Undici)
   ├─ Cache MISS → HTTP request → Cache response
   └─ Cache HIT → Return from cache
3. Orders creates order with product snapshot
4. Orders → EventBridge: order.created event
```

**Cache Invalidation**:
```typescript
// When Catalog publishes product.updated event
eventBus.on('product.updated', (event) => {
  catalogClient.invalidateProduct(event.productId);
});
```

### Pattern 2: Asynchronous Event-Driven

**Scenario**: When order completes, issue reward points

```typescript
// Orders Service
const order = Order.create(customerId, items);
await orderRepository.save(order);

// Publish event
await eventPublisher.publish(new OrderCompletedEvent({
  orderId: order.id,
  customerId: order.customerId,
  totalAmount: order.totalAmount.amount
}));

// ↓ EventBridge routes to Rewards Service

// Rewards Service (different Lambda, different database)
export const handler: EventBridgeHandler = async (event) => {
  const { customerId, totalAmount } = event.detail;
  
  const points = Math.floor(totalAmount * 0.1);  // 10% back
  
  const reward = Reward.create(customerId, points);
  await rewardRepository.save(reward);
};
```

**Benefits**:
- ✅ Loose coupling
- ✅ Services don't know about each other
- ✅ Can add more subscribers without changing Orders
- ✅ Eventual consistency

---

## Testing Strategy

### Unit Tests (Domain Layer)

```typescript
// tests/unit/domain/models/order.test.ts
describe('Order', () => {
  it('should create order with valid data', () => {
    const items = [
      OrderItem.create('prod1', 'Product 1', 2, Money.create(10, 'USD'))
    ];
    
    const order = Order.create('customer1', items);
    
    expect(order.orderId).toBeDefined();
    expect(order.totalAmount.amount).toBe(20);
    expect(order.status.value).toBe('PENDING');
    expect(order.domainEvents).toHaveLength(1);
  });
  
  it('should not create order without items', () => {
    expect(() => {
      Order.create('customer1', []);
    }).toThrow('Order must have at least one item');
  });
});
```

### Integration Tests

```typescript
// tests/integration/use-cases/create-order.test.ts
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let mockCatalogClient: jest.Mocked<CatalogClient>;
  
  beforeEach(() => {
    mockCatalogClient = {
      getProducts: jest.fn().mockResolvedValue(new Map([
        ['prod1', { productId: 'prod1', name: 'Product 1', price: 10 }]
      ]))
    };
    
    useCase = new CreateOrderUseCase(
      orderRepository,
      mockCatalogClient,
      eventPublisher
    );
  });
  
  it('should create order and publish event', async () => {
    const dto = {
      customerId: 'customer1',
      items: [{ productId: 'prod1', quantity: 2 }]
    };
    
    const result = await useCase.execute(dto);
    
    expect(result.orderId).toBeDefined();
    expect(result.totalAmount).toBe(20);
    expect(mockCatalogClient.getProducts).toHaveBeenCalled();
  });
});
```

---

## Deployment Guide

### Step 1: Install Dependencies

```bash
# Root
npm install

# Install all packages
npx lerna bootstrap
```

### Step 2: Build

```bash
# Build all services
npm run build

# Or build specific service
cd services/orders-service
npm run build
```

### Step 3: Deploy Infrastructure

```bash
# Deploy Orders service
cd services/orders-service
npm run deploy

# Deploy all services
npm run deploy:all
```

### Step 4: Test

```bash
# Test API
curl -X POST https://your-api.com/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer123",
    "items": [
      { "productId": "prod1", "quantity": 2 }
    ]
  }'
```

---

## Best Practices

### ✅ DO

1. **Keep domain logic in domain layer**
   ```typescript
   // ✅ GOOD
   order.cancel('Customer request');  // Business logic in aggregate
   
   // ❌ BAD
   order.status = OrderStatus.CANCELLED;  // Bypassing business logic
   ```

2. **Use value objects for concepts**
   ```typescript
   // ✅ GOOD
   const price = Money.create(10, 'USD');
   price.add(Money.create(5, 'USD'));  // Rich behavior
   
   // ❌ BAD
   const price = 10;
   const totalPrice = price + 5;  // Primitive obsession
   ```

3. **ACL for external services**
   ```typescript
   // ✅ GOOD
   const product = await catalogClient.getProduct(id);  // ACL
   
   // ❌ BAD
   const product = await httpClient.get('/products/' + id);  // Direct coupling
   ```

4. **Publish domain events after persistence**
   ```typescript
   // ✅ GOOD
   await repository.save(order);
   await eventPublisher.publish(order.domainEvents);
   
   // ❌ BAD
   await eventPublisher.publish(order.domainEvents);
   await repository.save(order);  // Event published before save!
   ```

### ❌ DON'T

1. **Don't put infrastructure in domain**
2. **Don't bypass aggregate for writes**
3. **Don't share database between contexts**
4. **Don't use synchronous calls for non-critical data**

---

## Monitoring

### CloudWatch Metrics

- Lambda duration, errors, throttles
- API Gateway 4xx/5xx, latency
- DynamoDB read/write capacity
- EventBridge failed deliveries

### X-Ray Tracing

All Lambdas have X-Ray enabled to trace:
- API Gateway → Lambda
- Lambda → DynamoDB
- Lambda → EventBridge
- Lambda → External HTTP (Undici)

### Logs

Structured logging with correlation IDs:
```typescript
console.log('[CreateOrderUseCase] Creating order', {
  customerId,
  itemCount: items.length,
  correlationId: event.headers['x-correlation-id']
});
```

---

## Summary

This project demonstrates:

✅ **Domain-Driven Design**: Aggregates, Value Objects, Repositories  
✅ **Clean Architecture**: Dependency inversion, layered structure  
✅ **Bounded Contexts**: Independent microservices  
✅ **Event-Driven**: Async communication via EventBridge  
✅ **HTTP Caching**: Undici with intelligent caching  
✅ **Resilience**: Circuit breaker, retry logic  
✅ **Anti-Corruption Layer**: Protection between contexts  
✅ **Infrastructure as Code**: AWS CDK  

**Next Steps**:
1. Add more use cases (update order, cancel order)
2. Implement Catalog and Rewards services
3. Add authentication/authorization
4. Implement saga pattern for distributed transactions
5. Add API documentation (OpenAPI)
6. Set up CI/CD pipeline
