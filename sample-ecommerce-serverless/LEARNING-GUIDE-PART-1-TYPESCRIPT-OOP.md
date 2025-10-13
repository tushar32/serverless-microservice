# 📘 Part 1: TypeScript & OOP Fundamentals

> **Learning Path**: Part 1 → [Part 2: Design Patterns](./LEARNING-GUIDE-PART-2-PATTERNS.md) → [Part 3: DDD](./LEARNING-GUIDE-PART-3-DDD.md) → [Part 4: Practice](./LEARNING-GUIDE-PART-4-PRACTICE.md)

## Table of Contents
1. [TypeScript Type System](#typescript-type-system)
2. [Classes and Access Modifiers](#classes-access-modifiers)
3. [Getters and Setters](#getters-setters)
4. [Static Methods](#static-methods)
5. [OOP Principles](#oop-principles)
6. [Interfaces vs Types](#interfaces-types)
7. [Generics](#generics)

---

## 1. TypeScript Type System {#typescript-type-system}

### Basic Types

```typescript
// Primitives
const orderId: string = "order-123";
const quantity: number = 5;
const isActive: boolean = true;
const createdAt: Date = new Date();

// Arrays
const items: string[] = ["item1", "item2"];
const prices: Array<number> = [10.99, 20.50];

// Object type
const product: { id: string; name: string; price: number } = {
  id: "p1",
  name: "Mouse",
  price: 29.99
};
```

### Type Aliases

```typescript
type Product = {
  id: string;
  name: string;
  price: number;
};

type OrderStatus = "pending" | "confirmed" | "completed" | "cancelled";

const status: OrderStatus = "pending"; // ✅
// const bad: OrderStatus = "invalid"; // ❌ Error
```

### Optional and Readonly

```typescript
type User = {
  id: string;
  name: string;
  email?: string;           // Optional
  readonly createdAt: Date; // Cannot modify
};

const user: User = {
  id: "1",
  name: "John",
  createdAt: new Date()
};

// user.createdAt = new Date(); // ❌ Error
```

---

## 2. Classes and Access Modifiers {#classes-access-modifiers}

### The Three Access Modifiers

```typescript
class Order {
  // PUBLIC: accessible everywhere (default)
  public orderId: string;
  
  // PRIVATE: only accessible within this class
  private customerId: string;
  
  // PROTECTED: accessible in this class and subclasses
  protected status: string;

  constructor(orderId: string, customerId: string) {
    this.orderId = orderId;
    this.customerId = customerId;
    this.status = "pending";
  }

  // Public method
  public getCustomerId(): string {
    return this.customerId;
  }

  // Private method
  private validateStatus(): boolean {
    return this.status !== "cancelled";
  }

  // Using private method
  public confirm(): void {
    if (this.validateStatus()) {
      this.status = "confirmed";
    }
  }
}

const order = new Order("ord-1", "cust-1");
console.log(order.orderId);        // ✅ Public
console.log(order.getCustomerId()); // ✅ Public method
// console.log(order.customerId);   // ❌ Error: Private
// order.validateStatus();          // ❌ Error: Private
```

### Why Use Private?

**❌ Without Private (Bad)**
```typescript
class BankAccount {
  balance: number; // Public by default

  constructor(balance: number) {
    this.balance = balance;
  }
}

const account = new BankAccount(1000);
account.balance = -500; // ❌ Nothing stops this!
account.balance = 999999; // ❌ Can cheat!
```

**✅ With Private (Good)**
```typescript
class BankAccount {
  private balance: number; // Protected!

  constructor(balance: number) {
    this.balance = balance;
  }

  withdraw(amount: number): boolean {
    // Business rules enforced here
    if (amount > 0 && amount <= this.balance) {
      this.balance -= amount;
      return true;
    }
    return false;
  }

  getBalance(): number {
    return this.balance;
  }
}

const account = new BankAccount(1000);
// account.balance = -500;  // ❌ Error: Private
account.withdraw(100);      // ✅ Must use method
```

### Constructor Shorthand

```typescript
// ❌ Long way
class OrderLong {
  private orderId: string;
  private customerId: string;

  constructor(orderId: string, customerId: string) {
    this.orderId = orderId;
    this.customerId = customerId;
  }
}

// ✅ Short way - TypeScript magic!
class Order {
  constructor(
    private orderId: string,
    private customerId: string,
    public status: string = "pending"
  ) {
    // Properties automatically created and assigned!
  }

  getOrderId(): string {
    return this.orderId;
  }
}
```

---

## 3. Getters and Setters {#getters-setters}

### Basic Getters

```typescript
class Order {
  private _orderId: string;
  private _items: string[];

  constructor(orderId: string) {
    this._orderId = orderId;
    this._items = [];
  }

  // Getter - access like a property, NO parentheses!
  get orderId(): string {
    return this._orderId;
  }

  // Getter with logic
  get itemCount(): number {
    return this._items.length;
  }

  // Return a copy to prevent external mutation
  get items(): string[] {
    return [...this._items]; // Copy, not reference
  }
}

const order = new Order("ord-1");
console.log(order.orderId);   // ✅ "ord-1" - looks like property
console.log(order.itemCount); // ✅ 0 - calculated on the fly
// console.log(order.orderId()); // ❌ Error: not a function!
```

### Getters with Setters

```typescript
class Temperature {
  private _celsius: number;

  constructor(celsius: number) {
    this._celsius = celsius;
  }

  get celsius(): number {
    return this._celsius;
  }

  set celsius(value: number) {
    if (value < -273.15) {
      throw new Error("Below absolute zero!");
    }
    this._celsius = value;
  }

  get fahrenheit(): number {
    return (this._celsius * 9/5) + 32;
  }

  set fahrenheit(value: number) {
    this._celsius = (value - 32) * 5/9;
  }
}

const temp = new Temperature(25);
console.log(temp.celsius);    // 25
console.log(temp.fahrenheit); // 77

temp.celsius = 30;            // Using setter
console.log(temp.fahrenheit); // 86

temp.fahrenheit = 100;        // Using setter
console.log(temp.celsius);    // 37.78
```

### Read-Only with Getter (No Setter)

```typescript
class Order {
  private _orderId: string;
  private _createdAt: Date;

  constructor(orderId: string) {
    this._orderId = orderId;
    this._createdAt = new Date();
  }

  // Read-only - no setter!
  get orderId(): string {
    return this._orderId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}

const order = new Order("ord-1");
console.log(order.orderId);     // ✅ Read
// order.orderId = "new-id";    // ❌ Error: Cannot assign (no setter)
```

### Real Example from Your Codebase

```typescript
// From: services/orders-service/src/domain/models/order.ts
export class Order extends AggregateRoot<OrderProps> {
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  // Getter - read-only access
  get orderId(): string {
    return this.props.orderId;
  }

  get items(): OrderItem[] {
    return [...this.props.items]; // Return copy!
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }
}

// Usage
const order = Order.create(customerId, items);
console.log(order.orderId);      // ✅ Read
console.log(order.totalAmount);  // ✅ Read
// order.orderId = "new";        // ❌ Error: no setter
```

---

## 4. Static Methods {#static-methods}

### What is Static?

**Static** = belongs to the CLASS, not to instances

```typescript
class MathUtils {
  static PI: number = 3.14159;

  // Static method - call on class
  static calculateArea(radius: number): number {
    return this.PI * radius * radius;
  }

  // Instance method - call on object
  square(n: number): number {
    return n * n;
  }
}

// Static - no need to create object
console.log(MathUtils.PI);                  // ✅ 3.14159
console.log(MathUtils.calculateArea(5));    // ✅ 78.54

// Instance - need object
const utils = new MathUtils();
console.log(utils.square(5));               // ✅ 25
// console.log(utils.calculateArea(5));     // ❌ Error: not on instance
```

### Static Factory Methods

**Why use static factory instead of constructor?**

```typescript
// ❌ Problem with public constructor
class Order {
  constructor(
    public orderId: string,
    public customerId: string,
    public items: any[],
    public totalAmount: number,
    public status: string,
    public createdAt: Date
  ) {
    // No validation!
    // Caller must provide ALL parameters
    // No business logic
  }
}

// Caller must know everything
const order = new Order(
  "ord-123",
  "cust-1",
  [],              // ❌ Empty items - invalid!
  -100,            // ❌ Negative total - invalid!
  "invalid-status", // ❌ Wrong status
  new Date()
);

// ✅ Solution: Static factory + private constructor
class Order {
  private constructor(
    public orderId: string,
    public customerId: string,
    public items: any[],
    public totalAmount: number,
    public status: string,
    public createdAt: Date
  ) {}

  // Static factory method
  static create(customerId: string, items: any[]): Order {
    // Validation BEFORE object exists
    if (!items || items.length === 0) {
      throw new Error("Order must have items");
    }

    // Calculate derived values
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
    
    // Set defaults
    const orderId = `ord-${Date.now()}`;
    const status = "pending";
    const createdAt = new Date();

    // NOW create the object (guaranteed valid)
    return new Order(orderId, customerId, items, totalAmount, status, createdAt);
  }
}

// Clean API - only provide what you know
const order = Order.create("cust-1", [
  { name: "Mouse", price: 29.99 },
  { name: "Keyboard", price: 79.99 }
]);
// ✅ orderId, totalAmount, status, createdAt all set automatically
// ✅ Validation ensures it's valid
```

### Real Example from Your Codebase

```typescript
// From: services/orders-service/src/domain/models/order.ts
export class Order extends AggregateRoot<OrderProps> {
  
  // Private constructor - can't call directly
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  // Static factory - ONLY way to create Order
  static create(customerId: string, items: OrderItem[]): Order {
    // Business Rule 1: Must have items
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Business Rule 2: Must have customer
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Calculate total
    const totalAmount = this.calculateTotal(items);
    
    // Generate ID
    const orderId = this.generateId();
    
    // Create with defaults
    const order = new Order({
      orderId,
      customerId,
      items,
      totalAmount,
      status: OrderStatus.PENDING, // Default
      createdAt: new Date(),
      updatedAt: new Date()
    }, orderId);

    // Emit domain event
    order.addDomainEvent(new OrderCreatedEvent({...}));

    return order;
  }

  // Another static factory for reconstitution from DB
  static reconstitute(props: OrderProps): Order {
    return new Order(props, props.orderId);
  }
}

// Usage
const order = Order.create(customerId, items); // ✅ Clean!
// const bad = new Order(...);                 // ❌ Error: Private constructor
```

---

## 5. OOP Principles {#oop-principles}

### Encapsulation

**Definition**: Hide internal state, expose only what's needed

```typescript
// ❌ Bad - no encapsulation
class Order {
  items: any[] = [];
  total: number = 0;
}

const order = new Order();
order.items.push({ price: 100 });
// ❌ Forgot to update total!
console.log(order.total); // 0 - WRONG!

// ✅ Good - encapsulated
class Order {
  private items: any[] = [];
  private total: number = 0;

  addItem(item: any): void {
    this.items.push(item);
    this.total += item.price; // Always in sync!
  }

  getTotal(): number {
    return this.total;
  }
}

const order = new Order();
order.addItem({ price: 100 });
console.log(order.getTotal()); // 100 - CORRECT!
```

### Abstraction

**Definition**: Hide complexity, show only essential features

```typescript
// Complex implementation hidden
class EmailService {
  private smtp: any;
  private templates: any;

  // Simple interface
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    // Complex logic hidden
    const template = this.templates.get("welcome");
    const html = this.renderTemplate(template, { name });
    await this.smtp.send({ to: email, html });
  }

  private renderTemplate(template: any, data: any): string {
    // Complex rendering logic
    return "...";
  }
}

// User doesn't need to know about SMTP, templates, rendering
const emailService = new EmailService();
await emailService.sendWelcomeEmail("user@example.com", "John");
```

### Inheritance

```typescript
// Base class
class Animal {
  constructor(protected name: string) {}

  makeSound(): void {
    console.log("Some sound");
  }
}

// Derived class
class Dog extends Animal {
  constructor(name: string, private breed: string) {
    super(name); // Call parent constructor
  }

  // Override parent method
  makeSound(): void {
    console.log(`${this.name} barks: Woof!`);
  }

  // New method
  fetch(): void {
    console.log(`${this.name} fetches the ball`);
  }
}

const dog = new Dog("Buddy", "Golden Retriever");
dog.makeSound(); // "Buddy barks: Woof!"
dog.fetch();     // "Buddy fetches the ball"
```

### Polymorphism

**Definition**: Same interface, different implementations

```typescript
interface PaymentMethod {
  processPayment(amount: number): Promise<boolean>;
}

class CreditCardPayment implements PaymentMethod {
  async processPayment(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via Credit Card`);
    // Credit card logic
    return true;
  }
}

class PayPalPayment implements PaymentMethod {
  async processPayment(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via PayPal`);
    // PayPal logic
    return true;
  }
}

class CashPayment implements PaymentMethod {
  async processPayment(amount: number): Promise<boolean> {
    console.log(`Processing $${amount} via Cash`);
    // Cash logic
    return true;
  }
}

// Same interface, different behavior
async function checkout(method: PaymentMethod, amount: number) {
  await method.processPayment(amount);
}

checkout(new CreditCardPayment(), 100);
checkout(new PayPalPayment(), 200);
checkout(new CashPayment(), 50);
```

---

## 6. Interfaces vs Types {#interfaces-types}

### Interface

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

// Can extend
interface PhysicalProduct extends Product {
  weight: number;
  dimensions: { width: number; height: number; depth: number };
}

// Can implement in class
class Book implements Product {
  constructor(
    public id: string,
    public name: string,
    public price: number,
    public author: string
  ) {}
}
```

### Type Alias

```typescript
type Product = {
  id: string;
  name: string;
  price: number;
};

// Can intersect
type PhysicalProduct = Product & {
  weight: number;
};

// Can use for unions
type Status = "pending" | "confirmed" | "completed";

// Can use for primitives
type ID = string | number;
```

### When to Use Which?

```typescript
// ✅ Use INTERFACE for:
// 1. Object shapes
interface User {
  id: string;
  name: string;
}

// 2. Classes to implement
class Admin implements User {
  constructor(public id: string, public name: string) {}
}

// ✅ Use TYPE for:
// 1. Union types
type Result = Success | Error;

// 2. Literal types
type Status = "active" | "inactive";

// 3. Tuples
type Coordinate = [number, number];

// 4. Utility types
type ReadonlyUser = Readonly<User>;
```

---

## 7. Generics {#generics}

### Why Generics?

```typescript
// ❌ Without generics - need separate functions
function getFirstString(arr: string[]): string {
  return arr[0];
}

function getFirstNumber(arr: number[]): number {
  return arr[0];
}

// ✅ With generics - one function for all
function getFirst<T>(arr: T[]): T {
  return arr[0];
}

const first = getFirst(["a", "b", "c"]); // string
const num = getFirst([1, 2, 3]);         // number
const bool = getFirst([true, false]);    // boolean
```

### Generic Classes

```typescript
class Box<T> {
  private content: T;

  constructor(content: T) {
    this.content = content;
  }

  getContent(): T {
    return this.content;
  }

  setContent(content: T): void {
    this.content = content;
  }
}

const stringBox = new Box<string>("Hello");
const numberBox = new Box<number>(42);

console.log(stringBox.getContent()); // "Hello"
console.log(numberBox.getContent()); // 42
```

### Generic Constraints

```typescript
interface HasId {
  id: string;
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

const products = [
  { id: "1", name: "Mouse", price: 29.99 },
  { id: "2", name: "Keyboard", price: 79.99 }
];

const product = findById(products, "1");
// ✅ TypeScript knows product has id, name, price
```

### Real Example: Repository Pattern

```typescript
// From: shared/domain-primitives
interface Entity {
  id: string;
}

interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Specific implementation
interface Order extends Entity {
  customerId: string;
  total: number;
}

class OrderRepository implements Repository<Order> {
  async findById(id: string): Promise<Order | null> {
    // DynamoDB query
    return null;
  }

  async save(order: Order): Promise<void> {
    // DynamoDB put
  }

  async delete(id: string): Promise<void> {
    // DynamoDB delete
  }
}
```

---

## Quick Reference

### Access Modifiers
- `public` - accessible everywhere (default)
- `private` - only within the class
- `protected` - within class and subclasses

### Getters/Setters
```typescript
get propertyName(): Type { return this._value; }
set propertyName(value: Type) { this._value = value; }
// Use like: obj.propertyName (no parentheses!)
```

### Static Methods
```typescript
static methodName() { }
// Call like: ClassName.methodName()
```

### Factory Pattern
```typescript
class MyClass {
  private constructor() {}
  static create(): MyClass { return new MyClass(); }
}
```

---

**Next**: [Part 2: Design Patterns →](./LEARNING-GUIDE-PART-2-PATTERNS.md)
