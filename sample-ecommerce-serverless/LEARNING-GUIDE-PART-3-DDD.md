# 📘 Part 3: Domain-Driven Design (DDD) Patterns

> **Learning Path**: [Part 1: TypeScript & OOP](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md) → [Part 2: Design Patterns](./LEARNING-GUIDE-PART-2-PATTERNS.md) → Part 3 → [Part 4: Practice](./LEARNING-GUIDE-PART-4-PRACTICE.md)

## Table of Contents
1. [DDD Building Blocks](#ddd-building-blocks)
2. [Entities](#entities)
3. [Value Objects](#value-objects)
4. [Aggregates](#aggregates)
5. [Domain Events](#domain-events)
6. [Repositories](#repositories)
7. [Layered Architecture](#layered-architecture)

---

## 1. DDD Building Blocks {#ddd-building-blocks}

### The Big Picture

```
┌─────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                         │
│  (Pure business logic - NO infrastructure dependencies) │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Aggregates  │  │Value Objects │  │Domain Events │ │
│  │  - Order     │  │  - Money     │  │- OrderCreated│ │
│  │  - Product   │  │  - Status    │  │- OrderPaid   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
           ▲                                    │
           │                                    │
           │ Uses                               │ Emits
           │                                    ▼
┌─────────────────────────────────────────────────────────┐
│              APPLICATION LAYER                          │
│         (Orchestrates domain objects)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Use Cases                                       │  │
│  │  - CreateOrderUseCase                            │  │
│  │  - ConfirmOrderUseCase                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                                    ▲
           │ Calls                              │ Implements
           ▼                                    │
┌─────────────────────────────────────────────────────────┐
│            INFRASTRUCTURE LAYER                         │
│       (Technical implementation details)                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Repositories │  │ HTTP Clients │  │Event Publisher│ │
│  │  - DynamoDB  │  │  - Undici    │  │- EventBridge │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Entities {#entities}

### What is an Entity?

**Entity** = An object with a unique identity that persists over time

**Key characteristic**: Identity, not attributes

```typescript
// Two orders with same data but different IDs = DIFFERENT entities
const order1 = { id: "ord-1", customerId: "cust-1", total: 100 };
const order2 = { id: "ord-2", customerId: "cust-1", total: 100 };

// order1 !== order2 (different IDs)
```

### Entity Base Class

```typescript
// From: shared/domain-primitives/src/entity.ts
export abstract class Entity<T> {
  protected readonly props: T;
  protected readonly _id: string;

  constructor(props: T, id: string) {
    this.props = props;
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  // Equality based on ID, not properties
  public equals(entity?: Entity<T>): boolean {
    if (!entity) {
      return false;
    }
    return this._id === entity._id;
  }
}
```

### Example: OrderItem Entity

```typescript
// From: services/orders-service/src/domain/models/order-item.ts
export interface OrderItemProps {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export class OrderItem extends Entity<OrderItemProps> {
  
  private constructor(props: OrderItemProps, id: string) {
    super(props, id);
  }

  static create(
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: Money
  ): OrderItem {
    // Validation
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Calculate derived value
    const lineTotal = unitPrice.multiply(quantity);
    const id = `${productId}-${Date.now()}`;

    return new OrderItem({
      productId,
      productName,
      quantity,
      unitPrice,
      lineTotal
    }, id);
  }

  // Getters
  get productId(): string {
    return this.props.productId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get lineTotal(): Money {
    return this.props.lineTotal;
  }

  // Business method
  updateQuantity(newQuantity: number): OrderItem {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const newLineTotal = this.props.unitPrice.multiply(newQuantity);
    
    // Return new instance (immutability)
    return new OrderItem({
      ...this.props,
      quantity: newQuantity,
      lineTotal: newLineTotal
    }, this._id);
  }
}
```

**Key Points**:
- ✅ Has unique ID
- ✅ Mutable (can change over time)
- ✅ Equality based on ID
- ✅ Encapsulates business logic

---

## 3. Value Objects {#value-objects}

### What is a Value Object?

**Value Object** = An object defined by its attributes, not identity

**Key characteristics**:
- No unique ID
- Immutable
- Equality based on all attributes

```typescript
// Two Money objects with same amount and currency = SAME
const money1 = Money.create(100, "USD");
const money2 = Money.create(100, "USD");
// money1.equals(money2) === true
```

### Value Object Base Class

```typescript
// From: shared/domain-primitives/src/value-object.ts
export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props); // Immutable!
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (!vo) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
```

### Example: Money Value Object

```typescript
// From: services/orders-service/src/domain/models/value-objects/money.ts
interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: string = 'USD'): Money {
    // Validation
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter ISO code');
    }

    return new Money({ amount, currency: currency.toUpperCase() });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  // Business operations return NEW instances (immutability)
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies`);
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract different currencies`);
    }
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(this.amount * factor, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error('Cannot compare different currencies');
    }
    return this.amount > other.amount;
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}

// Usage
const price = Money.create(29.99, "USD");
const tax = Money.create(2.50, "USD");
const total = price.add(tax); // New Money object

console.log(total.toString()); // "USD 32.49"

// price is unchanged (immutable)
console.log(price.toString()); // "USD 29.99"
```

### Example: OrderStatus Value Object

```typescript
export type OrderStatusType = "pending" | "confirmed" | "completed" | "cancelled";

export class OrderStatus extends ValueObject<{ value: OrderStatusType }> {
  
  static readonly PENDING = new OrderStatus({ value: "pending" });
  static readonly CONFIRMED = new OrderStatus({ value: "confirmed" });
  static readonly COMPLETED = new OrderStatus({ value: "completed" });
  static readonly CANCELLED = new OrderStatus({ value: "cancelled" });

  private constructor(props: { value: OrderStatusType }) {
    super(props);
  }

  canTransitionTo(newStatus: OrderStatus): boolean {
    const transitions: Record<OrderStatusType, OrderStatusType[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
      completed: [],
      cancelled: []
    };

    return transitions[this.props.value].includes(newStatus.props.value);
  }

  isPending(): boolean {
    return this.equals(OrderStatus.PENDING);
  }

  isFinal(): boolean {
    return this.equals(OrderStatus.COMPLETED) || this.equals(OrderStatus.CANCELLED);
  }

  toString(): string {
    return this.props.value;
  }
}

// Usage
let status = OrderStatus.PENDING;

if (status.canTransitionTo(OrderStatus.CONFIRMED)) {
  status = OrderStatus.CONFIRMED; // ✅
}

// status.canTransitionTo(OrderStatus.PENDING); // ❌ false
```

**When to Use Value Objects**:
- ✅ Money, dates, addresses, email
- ✅ Measurements (weight, distance)
- ✅ Status codes, enums
- ✅ Anything without identity

---

## 4. Aggregates {#aggregates}

### What is an Aggregate?

**Aggregate** = A cluster of objects (entities + value objects) treated as a single unit

**Aggregate Root** = The main entity that controls access to the aggregate

### The 4 Golden Rules

1. **One Root Per Aggregate**: All access goes through the root
2. **Reference by ID**: Other aggregates referenced by ID only
3. **One Transaction**: Changes to one aggregate = one transaction
4. **Root Enforces Invariants**: Root ensures all business rules

### Aggregate Root Base Class

```typescript
// From: shared/domain-primitives/src/aggregate-root.ts
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  protected static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Example: Order Aggregate

```
Order (Aggregate Root)
├── orderId (identity)
├── customerId (reference to Customer aggregate by ID)
├── OrderItem[] (entities within aggregate)
│   ├── OrderItem 1
│   ├── OrderItem 2
│   └── OrderItem 3
├── totalAmount (Money value object)
├── status (OrderStatus value object)
└── timestamps
```

```typescript
// From: services/orders-service/src/domain/models/order.ts
export interface OrderProps {
  orderId: string;
  customerId: string;      // ✅ Reference by ID, not whole Customer object
  items: OrderItem[];      // ✅ Entities within aggregate
  totalAmount: Money;      // ✅ Value object
  status: OrderStatus;     // ✅ Value object
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot<OrderProps> {
  
  // Private constructor - enforce factory method
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  // Factory method - ONLY way to create Order
  static create(customerId: string, items: OrderItem[]): Order {
    // Invariant 1: Order must have items
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Invariant 2: Customer ID required
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const orderId = this.generateId();
    const totalAmount = this.calculateTotal(items);
    const now = new Date();

    const order = new Order({
      orderId,
      customerId,
      items,
      totalAmount,
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now
    }, orderId);

    // Emit domain event
    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id,
      customerId: order.customerId,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount
      })),
      totalAmount: totalAmount.amount,
      currency: totalAmount.currency
    }));

    return order;
  }

  // Getters - read-only access
  get orderId(): string {
    return this.props.orderId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get items(): OrderItem[] {
    return [...this.props.items]; // Return copy to prevent mutation
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  // Business method: Confirm order
  confirm(): void {
    // Invariant: Can only confirm pending orders
    if (!this.status.canTransitionTo(OrderStatus.CONFIRMED)) {
      throw new Error(`Cannot confirm order in ${this.status} status`);
    }

    this.props.status = OrderStatus.CONFIRMED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.orderId,
      customerId: this.customerId,
      totalAmount: this.totalAmount.amount,
      currency: this.totalAmount.currency,
      confirmedAt: this.props.updatedAt.toISOString()
    }));
  }

  // Business method: Add item
  addItem(item: OrderItem): void {
    // Invariant: Can only modify pending orders
    if (!this.status.isPending()) {
      throw new Error('Can only add items to pending orders');
    }

    this.props.items.push(item);
    this.props.totalAmount = Order.calculateTotal(this.props.items);
    this.props.updatedAt = new Date();
  }

  // Business method: Remove item
  removeItem(productId: string): void {
    if (!this.status.isPending()) {
      throw new Error('Can only remove items from pending orders');
    }

    this.props.items = this.props.items.filter(
      item => item.productId !== productId
    );

    // Invariant: Order must have at least one item
    if (this.props.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    this.props.totalAmount = Order.calculateTotal(this.props.items);
    this.props.updatedAt = new Date();
  }

  // Business method: Cancel order
  cancel(reason: string): void {
    if (!this.status.canTransitionTo(OrderStatus.CANCELLED)) {
      throw new Error(`Cannot cancel order in ${this.status} status`);
    }

    if (this.status.isFinal()) {
      throw new Error('Cannot cancel a completed or already cancelled order');
    }

    this.props.status = OrderStatus.CANCELLED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(new OrderCancelledEvent({
      orderId: this.orderId,
      customerId: this.customerId,
      reason,
      cancelledAt: this.props.updatedAt.toISOString()
    }));
  }

  // Private helper
  private static calculateTotal(items: OrderItem[]): Money {
    if (items.length === 0) {
      return Money.create(0);
    }

    return items.reduce(
      (total, item) => total.add(item.lineTotal),
      Money.create(0, items[0].unitPrice.currency)
    );
  }
}
```

**Key Points**:
- ✅ All access through root (`Order`)
- ✅ Can't modify `OrderItem` directly
- ✅ All business rules enforced
- ✅ Emits domain events
- ✅ Maintains consistency

---

## 5. Domain Events {#domain-events}

### What are Domain Events?

**Domain Event** = Something that happened in the domain that domain experts care about

```typescript
// From: shared/domain-primitives/src/domain-event.ts
export abstract class DomainEvent {
  public readonly occurredAt: Date;

  constructor() {
    this.occurredAt = new Date();
  }
}
```

### Example: Order Events

```typescript
// From: services/orders-service/src/domain/events/order-created.event.ts
export class OrderCreatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      orderId: string;
      customerId: string;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
      }>;
      totalAmount: number;
      currency: string;
    }
  ) {
    super();
  }
}

export class OrderConfirmedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      orderId: string;
      customerId: string;
      totalAmount: number;
      currency: string;
      confirmedAt: string;
    }
  ) {
    super();
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      orderId: string;
      customerId: string;
      reason: string;
      cancelledAt: string;
    }
  ) {
    super();
  }
}
```

### Using Domain Events

```typescript
// 1. Aggregate emits events
class Order extends AggregateRoot<OrderProps> {
  confirm(): void {
    this.props.status = OrderStatus.CONFIRMED;
    
    // Emit event
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.orderId,
      customerId: this.customerId,
      totalAmount: this.totalAmount.amount,
      currency: this.totalAmount.currency,
      confirmedAt: new Date().toISOString()
    }));
  }
}

// 2. Use case publishes events
class CreateOrderUseCase {
  async execute(dto: CreateOrderDTO) {
    const order = Order.create(dto.customerId, dto.items);
    
    // Save
    await this.orderRepository.save(order);
    
    // Publish events
    for (const event of order.domainEvents) {
      await this.eventPublisher.publish(event);
    }
    
    order.clearEvents();
  }
}

// 3. Other services react to events
class RewardsService {
  async handleOrderConfirmed(event: OrderConfirmedEvent) {
    const points = this.calculatePoints(event.payload.totalAmount);
    await this.rewardRepository.addPoints(
      event.payload.customerId,
      points
    );
  }
}
```

**Benefits**:
- ✅ Decoupling between services
- ✅ Audit trail (what happened when)
- ✅ Event sourcing capability
- ✅ Asynchronous processing

---

## 6. Repositories {#repositories}

### Repository Interface

```typescript
// Domain layer defines interface
export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}
```

### Repository Implementation

```typescript
// Infrastructure layer implements
export class DynamoDBOrderRepository implements IOrderRepository {
  constructor(private dynamodb: DynamoDBClient) {}

  async findById(id: string): Promise<Order | null> {
    const result = await this.dynamodb.getItem({
      TableName: 'Orders',
      Key: { orderId: { S: id } }
    });

    if (!result.Item) return null;

    // Reconstitute aggregate from data
    return Order.reconstitute({
      orderId: result.Item.orderId.S!,
      customerId: result.Item.customerId.S!,
      items: JSON.parse(result.Item.items.S!),
      totalAmount: Money.create(
        parseFloat(result.Item.totalAmount.N!),
        result.Item.currency.S!
      ),
      status: this.mapStatus(result.Item.status.S!),
      createdAt: new Date(result.Item.createdAt.S!),
      updatedAt: new Date(result.Item.updatedAt.S!)
    });
  }

  async save(order: Order): Promise<void> {
    await this.dynamodb.putItem({
      TableName: 'Orders',
      Item: {
        orderId: { S: order.orderId },
        customerId: { S: order.customerId },
        items: { S: JSON.stringify(order.items) },
        totalAmount: { N: order.totalAmount.amount.toString() },
        currency: { S: order.totalAmount.currency },
        status: { S: order.status.toString() },
        createdAt: { S: order.createdAt.toISOString() },
        updatedAt: { S: order.updatedAt.toISOString() }
      }
    });
  }
}
```

---

## 7. Layered Architecture {#layered-architecture}

### The Four Layers

```
┌─────────────────────────────────────────────────────────┐
│  1. PRESENTATION LAYER (Lambda Handlers)                │
│     - Parse HTTP requests                               │
│     - Call use cases                                    │
│     - Format responses                                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  2. APPLICATION LAYER (Use Cases)                       │
│     - Orchestrate workflow                              │
│     - Coordinate domain objects                         │
│     - Manage transactions                               │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  3. DOMAIN LAYER (Business Logic)                       │
│     - Aggregates, Entities, Value Objects               │
│     - Domain Events                                     │
│     - Business rules                                    │
│     - NO infrastructure dependencies                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  4. INFRASTRUCTURE LAYER (Technical Details)            │
│     - Repositories (DynamoDB)                           │
│     - HTTP Clients                                      │
│     - Event Publishers (EventBridge)                    │
└─────────────────────────────────────────────────────────┘
```

### Complete Example

```typescript
// 1. PRESENTATION LAYER
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const dto: CreateOrderDTO = JSON.parse(event.body || '{}');
    const result = await createOrderUseCase.execute(dto);
    
    return {
      statusCode: 201,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return errorResponse(error);
  }
};

// 2. APPLICATION LAYER
export class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private catalogClient: CatalogClient,
    private eventPublisher: EventPublisher
  ) {}

  async execute(dto: CreateOrderDTO): Promise<OrderResponseDTO> {
    // Get products
    const products = await this.catalogClient.getProducts(productIds);
    
    // Create order items
    const orderItems = this.createOrderItems(dto.items, products);
    
    // Create Order aggregate (DOMAIN LAYER)
    const order = Order.create(dto.customerId, orderItems);
    
    // Save (INFRASTRUCTURE LAYER)
    await this.orderRepository.save(order);
    
    // Publish events (INFRASTRUCTURE LAYER)
    for (const event of order.domainEvents) {
      await this.eventPublisher.publish(event);
    }
    
    order.clearEvents();
    
    return this.toDTO(order);
  }
}

// 3. DOMAIN LAYER
export class Order extends AggregateRoot<OrderProps> {
  static create(customerId: string, items: OrderItem[]): Order {
    // Business rules
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Create aggregate
    const order = new Order({...}, orderId);
    
    // Emit event
    order.addDomainEvent(new OrderCreatedEvent({...}));
    
    return order;
  }
}

// 4. INFRASTRUCTURE LAYER
export class DynamoDBOrderRepository implements IOrderRepository {
  async save(order: Order): Promise<void> {
    await this.dynamodb.putItem({...});
  }
}
```

---

## Quick Reference

### DDD Building Blocks

| Concept | Identity | Mutable | Example |
|---------|----------|---------|---------|
| **Entity** | ✅ Yes | ✅ Yes | Order, OrderItem, Customer |
| **Value Object** | ❌ No | ❌ No | Money, Address, Email |
| **Aggregate** | ✅ Yes | ✅ Yes | Order (with OrderItems) |

### Aggregate Rules

1. ✅ One root per aggregate
2. ✅ Reference other aggregates by ID
3. ✅ One transaction per aggregate
4. ✅ Root enforces invariants

### Layer Responsibilities

- **Presentation**: HTTP parsing, response formatting
- **Application**: Workflow orchestration
- **Domain**: Business logic (NO infrastructure!)
- **Infrastructure**: Database, HTTP, events

---

**Next**: [Part 4: Practical Exercises →](./LEARNING-GUIDE-PART-4-PRACTICE.md)
