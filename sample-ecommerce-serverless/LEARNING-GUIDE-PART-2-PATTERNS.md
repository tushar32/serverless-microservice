# 📘 Part 2: Design Patterns

> **Learning Path**: [Part 1: TypeScript & OOP](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md) → Part 2 → [Part 3: DDD](./LEARNING-GUIDE-PART-3-DDD.md) → [Part 4: Practice](./LEARNING-GUIDE-PART-4-PRACTICE.md)

## Table of Contents
1. [Factory Pattern](#factory-pattern)
2. [Repository Pattern](#repository-pattern)
3. [Strategy Pattern](#strategy-pattern)
4. [Observer Pattern](#observer-pattern)
5. [Dependency Injection](#dependency-injection)
6. [SOLID Principles](#solid-principles)

---

## 1. Factory Pattern {#factory-pattern}

### Problem: Complex Object Creation

```typescript
// ❌ Problem: Constructor is complex and error-prone
class Order {
  constructor(
    public orderId: string,
    public customerId: string,
    public items: any[],
    public totalAmount: number,
    public status: string,
    public createdAt: Date,
    public updatedAt: Date
  ) {}
}

// Caller must know everything
const order = new Order(
  "ord-" + Date.now(),           // Generate ID
  customerId,
  items,
  items.reduce((sum, i) => sum + i.price, 0), // Calculate total
  "pending",                     // Default status
  new Date(),                    // Created
  new Date()                     // Updated
);
// ❌ Easy to make mistakes
// ❌ Duplicate logic everywhere
// ❌ No validation
```

### Solution: Factory Method Pattern

```typescript
class Order {
  // Private constructor - can't call directly
  private constructor(
    public orderId: string,
    public customerId: string,
    public items: any[],
    public totalAmount: number,
    public status: string,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  // Static factory method
  static create(customerId: string, items: any[]): Order {
    // Validation
    if (!items || items.length === 0) {
      throw new Error("Order must have items");
    }

    // Calculate derived values
    const orderId = `ord-${Date.now()}`;
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    const status = "pending";
    const now = new Date();

    // Create object
    return new Order(orderId, customerId, items, totalAmount, status, now, now);
  }

  // Another factory for different use case
  static reconstitute(data: any): Order {
    return new Order(
      data.orderId,
      data.customerId,
      data.items,
      data.totalAmount,
      data.status,
      new Date(data.createdAt),
      new Date(data.updatedAt)
    );
  }
}

// ✅ Clean usage
const order = Order.create(customerId, items);
const fromDb = Order.reconstitute(dbData);
```

### Real Example from Your Codebase

```typescript
// From: services/orders-service/src/domain/models/order.ts
export class Order extends AggregateRoot<OrderProps> {
  
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  // Factory for new orders
  static create(customerId: string, items: OrderItem[]): Order {
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
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

    order.addDomainEvent(new OrderCreatedEvent({...}));
    return order;
  }

  // Factory for loading from database
  static reconstitute(props: OrderProps): Order {
    return new Order(props, props.orderId);
  }
}
```

### Benefits

✅ **Encapsulation**: Hide complex creation logic  
✅ **Validation**: Ensure objects are always valid  
✅ **Flexibility**: Multiple creation methods  
✅ **Maintainability**: Change creation logic in one place  

### When to Use the Factory Pattern:

When the exact types of objects need to be determined at runtime.
When you want to centralize the object creation logic.
When the creation process involves complex logic or multiple steps.

---

## 2. Repository Pattern {#repository-pattern}

### Problem: Data Access Scattered

```typescript
// ❌ Bad: Data access mixed with business logic
class CreateOrderUseCase {
  async execute(dto: CreateOrderDTO) {
    const order = Order.create(dto.customerId, dto.items);
    
    // Direct DynamoDB access - BAD!
    await dynamodb.putItem({
      TableName: 'Orders',
      Item: {
        orderId: { S: order.orderId },
        customerId: { S: order.customerId },
        // ... complex mapping
      }
    });
  }
}

// Problems:
// ❌ Can't test without DynamoDB
// ❌ Can't switch databases
// ❌ DynamoDB details leak everywhere
```

### Solution: Repository Pattern

```typescript
// 1. Define interface (contract)
interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}

// 2. Implement for DynamoDB
class DynamoDBOrderRepository implements IOrderRepository {
  constructor(private dynamodb: DynamoDBClient) {}

  async findById(id: string): Promise<Order | null> {
    const result = await this.dynamodb.getItem({
      TableName: 'Orders',
      Key: { orderId: { S: id } }
    });

    if (!result.Item) return null;

    return Order.reconstitute({
      orderId: result.Item.orderId.S,
      customerId: result.Item.customerId.S,
      // ... map from DynamoDB format
    });
  }

  async save(order: Order): Promise<void> {
    await this.dynamodb.putItem({
      TableName: 'Orders',
      Item: {
        orderId: { S: order.orderId },
        customerId: { S: order.customerId },
        // ... map to DynamoDB format
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.dynamodb.deleteItem({
      TableName: 'Orders',
      Key: { orderId: { S: id } }
    });
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    // Query implementation
    return [];
  }
}

// 3. Use in application layer
class CreateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(dto: CreateOrderDTO) {
    const order = Order.create(dto.customerId, dto.items);
    await this.orderRepository.save(order); // ✅ Clean!
  }
}

// 4. Easy to test with mock
class MockOrderRepository implements IOrderRepository {
  private orders: Map<string, Order> = new Map();

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.orderId, order);
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(o => o.customerId === customerId);
  }
}

// Testing
const mockRepo = new MockOrderRepository();
const useCase = new CreateOrderUseCase(mockRepo);
await useCase.execute(dto); // ✅ No real database needed!
```

### Benefits

✅ **Testability**: Easy to mock  
✅ **Flexibility**: Switch databases without changing business logic  
✅ **Separation**: Data access separate from domain logic  
✅ **Reusability**: Same repository used everywhere  

---

## 3. Strategy Pattern {#strategy-pattern}

### Problem: Multiple Algorithms

```typescript
// ❌ Bad: If-else hell
class PaymentProcessor {
  processPayment(method: string, amount: number) {
    if (method === "credit_card") {
      // Credit card logic
      console.log("Processing credit card");
      // 50 lines of code
    } else if (method === "paypal") {
      // PayPal logic
      console.log("Processing PayPal");
      // 50 lines of code
    } else if (method === "crypto") {
      // Crypto logic
      console.log("Processing crypto");
      // 50 lines of code
    }
    // ❌ Hard to add new methods
    // ❌ Hard to test individual methods
    // ❌ Violates Open/Closed Principle
  }
}
```

### Solution: Strategy Pattern

```typescript
// 1. Define strategy interface
interface PaymentStrategy {
  process(amount: number): Promise<boolean>;
}

// 2. Implement concrete strategies
class CreditCardStrategy implements PaymentStrategy {
  constructor(private cardNumber: string, private cvv: string) {}

  async process(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via Credit Card`);
    // Credit card specific logic
    return true;
  }
}

class PayPalStrategy implements PaymentStrategy {
  constructor(private email: string) {}

  async process(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via PayPal`);
    // PayPal specific logic
    return true;
  }
}

class CryptoStrategy implements PaymentStrategy {
  constructor(private walletAddress: string) {}

  async process(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via Crypto`);
    // Crypto specific logic
    return true;
  }
}

// 3. Context class
class PaymentProcessor {
  constructor(private strategy: PaymentStrategy) {}

  async processPayment(amount: number): Promise<boolean> {
    return await this.strategy.process(amount);
  }

  // Can change strategy at runtime
  setStrategy(strategy: PaymentStrategy): void {
    this.strategy = strategy;
  }
}

// Usage
const creditCard = new CreditCardStrategy("1234-5678", "123");
const processor = new PaymentProcessor(creditCard);
await processor.processPayment(100);

// Switch strategy
const paypal = new PayPalStrategy("user@example.com");
processor.setStrategy(paypal);
await processor.processPayment(200);
```

### Benefits

✅ **Open/Closed**: Add new strategies without modifying existing code  
✅ **Testability**: Test each strategy independently  
✅ **Flexibility**: Switch algorithms at runtime  
✅ **Clean Code**: No if-else chains  

---

## 4. Observer Pattern (Event-Driven) {#observer-pattern}

### Problem: Tight Coupling

```typescript
// ❌ Bad: Tight coupling
class OrderService {
  async createOrder(dto: CreateOrderDTO) {
    const order = Order.create(dto.customerId, dto.items);
    await this.orderRepository.save(order);

    // Directly calling other services - BAD!
    await this.emailService.sendOrderConfirmation(order);
    await this.inventoryService.reserveItems(order.items);
    await this.rewardsService.addPoints(order.customerId, order.total);
    await this.analyticsService.trackOrder(order);
    
    // ❌ OrderService knows too much
    // ❌ Can't add new listeners without modifying this code
    // ❌ Hard to test
  }
}
```

### Solution: Observer Pattern (Domain Events)

```typescript
// 1. Define event
class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: any[],
    public readonly totalAmount: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

// 2. Event publisher interface
interface EventPublisher {
  publish(event: any): Promise<void>;
}

// 3. Domain object emits events
class Order {
  private domainEvents: any[] = [];

  static create(customerId: string, items: any[]): Order {
    const order = new Order(/* ... */);
    
    // Emit event instead of calling services
    order.addDomainEvent(new OrderCreatedEvent(
      order.orderId,
      order.customerId,
      order.items,
      order.totalAmount
    ));

    return order;
  }

  private addDomainEvent(event: any): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): any[] {
    return this.domainEvents;
  }

  clearEvents(): void {
    this.domainEvents = [];
  }
}

// 4. Use case publishes events
class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private eventPublisher: EventPublisher
  ) {}

  async execute(dto: CreateOrderDTO) {
    // Create order
    const order = Order.create(dto.customerId, dto.items);
    
    // Save order
    await this.orderRepository.save(order);
    
    // Publish events
    for (const event of order.getDomainEvents()) {
      await this.eventPublisher.publish(event);
    }
    
    order.clearEvents();
  }
}

// 5. Event handlers (observers) - completely decoupled
class EmailEventHandler {
  async handle(event: OrderCreatedEvent) {
    console.log(`Sending email for order ${event.orderId}`);
    // Send email
  }
}

class InventoryEventHandler {
  async handle(event: OrderCreatedEvent) {
    console.log(`Reserving items for order ${event.orderId}`);
    // Reserve inventory
  }
}

class RewardsEventHandler {
  async handle(event: OrderCreatedEvent) {
    console.log(`Adding points for order ${event.orderId}`);
    // Add reward points
  }
}

// 6. Event bus wires everything together
class EventBus implements EventPublisher {
  private handlers: Map<string, Function[]> = new Map();

  subscribe(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: any): Promise<void> {
    const eventType = event.constructor.name;
    const handlers = this.handlers.get(eventType) || [];
    
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

// Setup
const eventBus = new EventBus();
eventBus.subscribe('OrderCreatedEvent', (e) => new EmailEventHandler().handle(e));
eventBus.subscribe('OrderCreatedEvent', (e) => new InventoryEventHandler().handle(e));
eventBus.subscribe('OrderCreatedEvent', (e) => new RewardsEventHandler().handle(e));
```

### Benefits

✅ **Decoupling**: Order service doesn't know about email, inventory, etc.  
✅ **Extensibility**: Add new handlers without changing existing code  
✅ **Testability**: Test each handler independently  
✅ **Scalability**: Easy to move handlers to separate services  

---

## 5. Dependency Injection {#dependency-injection}

### Problem: Hard Dependencies

```typescript
// ❌ Bad: Hard-coded dependencies
class CreateOrderUseCase {
  private orderRepository: OrderRepository;
  private emailService: EmailService;

  constructor() {
    // Creating dependencies inside - BAD!
    this.orderRepository = new DynamoDBOrderRepository();
    this.emailService = new SESEmailService();
  }

  async execute(dto: CreateOrderDTO) {
    // ...
  }
}

// Problems:
// ❌ Can't test without real DynamoDB and SES
// ❌ Can't swap implementations
// ❌ Tight coupling
```

### Solution: Dependency Injection

```typescript
// ✅ Good: Inject dependencies
class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,  // Interface, not concrete class
    private emailService: IEmailService
  ) {}

  async execute(dto: CreateOrderDTO) {
    const order = Order.create(dto.customerId, dto.items);
    await this.orderRepository.save(order);
    await this.emailService.sendOrderConfirmation(order);
  }
}

// Production
const orderRepo = new DynamoDBOrderRepository();
const emailService = new SESEmailService();
const useCase = new CreateOrderUseCase(orderRepo, emailService);

// Testing
const mockRepo = new MockOrderRepository();
const mockEmail = new MockEmailService();
const testUseCase = new CreateOrderUseCase(mockRepo, mockEmail);
```

### Constructor Injection (Recommended)

```typescript
class OrderService {
  constructor(
    private orderRepository: IOrderRepository,
    private catalogClient: ICatalogClient,
    private eventPublisher: IEventPublisher
  ) {}
}

// All dependencies visible and testable
```

### Real Example from Your Codebase

```typescript
// From: services/orders-service/src/application/use-cases/create-order.use-case.ts
export class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private catalogClient: CatalogClient,
    private eventPublisher: EventPublisher
  ) {}

  async execute(dto: CreateOrderDTO): Promise<OrderResponseDTO> {
    // Use injected dependencies
    const products = await this.catalogClient.getProducts(productIds);
    const order = Order.create(dto.customerId, orderItems);
    await this.orderRepository.save(order);
    await this.eventPublisher.publish(event);
  }
}
```

---

## 6. SOLID Principles {#solid-principles}

### S - Single Responsibility Principle

**Each class should have ONE reason to change**

```typescript
// ❌ Bad: Multiple responsibilities
class Order {
  items: any[] = [];
  
  addItem(item: any) { /* ... */ }
  
  // ❌ Order shouldn't know how to save itself
  async saveToDB() {
    await dynamodb.putItem(/* ... */);
  }
  
  // ❌ Order shouldn't know how to send emails
  async sendConfirmationEmail() {
    await ses.sendEmail(/* ... */);
  }
}

// ✅ Good: Single responsibility
class Order {
  items: any[] = [];
  addItem(item: any) { /* ... */ }
  // Only business logic
}

class OrderRepository {
  async save(order: Order) { /* DB logic */ }
}

class EmailService {
  async sendOrderConfirmation(order: Order) { /* Email logic */ }
}
```

### O - Open/Closed Principle

**Open for extension, closed for modification**

```typescript
// ❌ Bad: Must modify to add new discount types
class DiscountCalculator {
  calculate(type: string, amount: number): number {
    if (type === "percentage") {
      return amount * 0.1;
    } else if (type === "fixed") {
      return 10;
    }
    // Must modify this code to add new types
  }
}

// ✅ Good: Extend without modifying
interface Discount {
  calculate(amount: number): number;
}

class PercentageDiscount implements Discount {
  constructor(private percent: number) {}
  calculate(amount: number): number {
    return amount * (this.percent / 100);
  }
}

class FixedDiscount implements Discount {
  constructor(private amount: number) {}
  calculate(amount: number): number {
    return this.amount;
  }
}

// Add new discount without changing existing code
class BuyOneGetOneDiscount implements Discount {
  calculate(amount: number): number {
    return amount / 2;
  }
}
```

### L - Liskov Substitution Principle

**Subclasses should be substitutable for their base classes**

```typescript
// ✅ Good: Square can replace Rectangle
class Rectangle {
  constructor(protected width: number, protected height: number) {}
  
  area(): number {
    return this.width * this.height;
  }
}

class Square extends Rectangle {
  constructor(size: number) {
    super(size, size);
  }
}

function printArea(rect: Rectangle) {
  console.log(rect.area());
}

printArea(new Rectangle(5, 10)); // Works
printArea(new Square(5));        // Also works - substitutable
```

### I - Interface Segregation Principle

**Don't force classes to implement interfaces they don't use**

```typescript
// ❌ Bad: Fat interface
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements Worker {
  work() { /* ... */ }
  eat() { /* ❌ Robots don't eat */ }
  sleep() { /* ❌ Robots don't sleep */ }
}

// ✅ Good: Segregated interfaces
interface Workable {
  work(): void;
}

interface Eatable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class Human implements Workable, Eatable, Sleepable {
  work() { /* ... */ }
  eat() { /* ... */ }
  sleep() { /* ... */ }
}

class Robot implements Workable {
  work() { /* ... */ }
  // Only implements what it needs
}
```

### D - Dependency Inversion Principle

**Depend on abstractions, not concretions**

```typescript
// ❌ Bad: High-level depends on low-level
class CreateOrderUseCase {
  private repo = new DynamoDBOrderRepository(); // Concrete class
  
  async execute(dto: CreateOrderDTO) {
    await this.repo.save(order);
  }
}

// ✅ Good: Both depend on abstraction
interface IOrderRepository {
  save(order: Order): Promise<void>;
}

class CreateOrderUseCase {
  constructor(private repo: IOrderRepository) {} // Interface
  
  async execute(dto: CreateOrderDTO) {
    await this.repo.save(order);
  }
}

class DynamoDBOrderRepository implements IOrderRepository {
  async save(order: Order) { /* ... */ }
}
```

---

## Pattern Combinations in Your Codebase

### Complete Flow

```typescript
// 1. Factory Pattern - Create domain object
const order = Order.create(customerId, items);

// 2. Observer Pattern - Emit events
order.addDomainEvent(new OrderCreatedEvent({...}));

// 3. Repository Pattern - Save to database
await orderRepository.save(order);

// 4. Strategy Pattern - Process payment
await paymentProcessor.process(order.totalAmount);

// 5. Dependency Injection - All wired together
class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,
    private paymentProcessor: IPaymentProcessor,
    private eventPublisher: IEventPublisher
  ) {}
}
```

---

## Quick Reference

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| **Factory** | Control object creation | Complex initialization, validation |
| **Repository** | Abstract data access | Separate domain from infrastructure |
| **Strategy** | Swap algorithms | Multiple ways to do same thing |
| **Observer** | Decouple components | React to events without tight coupling |
| **Dependency Injection** | Manage dependencies | Testability, flexibility |

---

**Next**: [Part 3: DDD Patterns →](./LEARNING-GUIDE-PART-3-DDD.md)
