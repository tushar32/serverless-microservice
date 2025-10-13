# 🎓 Complete Learning Guide: TypeScript, OOP, and DDD

## Welcome!

This comprehensive learning guide will teach you everything you need to understand and build your own serverless microservices using TypeScript, Object-Oriented Programming, Design Patterns, and Domain-Driven Design.

All examples are taken from **your actual codebase** - the e-commerce serverless microservices project.

---

## 📚 Learning Path

### **Recommended Order**

```
START HERE
    │
    ▼
┌─────────────────────────────────────────┐
│  Part 1: TypeScript & OOP Fundamentals  │  ⏱️ 2-3 hours
│  - Type system, classes, interfaces     │
│  - Access modifiers, getters/setters    │
│  - Static methods, generics             │
└─────────────────────────────────────────┘
    │
    ├──► Supplement: Arrays & Collections  │  ⏱️ 1-2 hours
    │    - Array methods (map, filter, reduce)
    │    - Immutable operations
    │    - Real-world examples
    │
    ▼
┌─────────────────────────────────────────┐
│  Part 2: Design Patterns                │  ⏱️ 2-3 hours
│  - Factory, Repository, Strategy        │
│  - Observer, Dependency Injection       │
│  - SOLID principles                     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Part 3: Domain-Driven Design           │  ⏱️ 3-4 hours
│  - Entities, Value Objects, Aggregates  │
│  - Domain Events, Repositories          │
│  - Layered Architecture                 │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Part 4: Practical Exercises            │  ⏱️ 4-6 hours
│  - Build Product aggregate              │
│  - Create value objects                 │
│  - Implement repositories               │
│  - Build complete Cart service          │
└─────────────────────────────────────────┘
    │
    ▼
  DONE! 🎉
```

**Total Time**: 12-18 hours of focused learning (including arrays supplement)

---

## 📖 Guide Contents

### [Part 1: TypeScript & OOP Fundamentals](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md)

**What You'll Learn**:
- ✅ TypeScript type system (primitives, objects, unions, generics)
- ✅ Classes and access modifiers (`private`, `public`, `protected`)
- ✅ Getters and setters (property-like access)
- ✅ Static methods (factory pattern foundation)
- ✅ OOP principles (encapsulation, abstraction, inheritance, polymorphism)
- ✅ Interfaces vs Types (when to use which)
- ✅ Generics (write reusable, type-safe code)

**Key Concepts**:
```typescript
// Private constructor + static factory
class Order {
  private constructor(props: OrderProps) {}
  static create(customerId: string, items: OrderItem[]): Order { }
}

// Getters (no parentheses!)
get orderId(): string { return this._orderId; }
console.log(order.orderId); // ✅ Like a property

// Generics
class Repository<T extends Entity> {
  async findById(id: string): Promise<T | null> { }
}
```

**Time**: 2-3 hours

---

### 📌 [Supplement: Arrays & Collections](./LEARNING-GUIDE-ARRAYS-COLLECTIONS.md)

**What You'll Learn**:
- ✅ Array methods (`map`, `filter`, `reduce`, `find`, `some`, `every`)
- ✅ Immutable operations (why and how)
- ✅ Working with object arrays
- ✅ Real-world examples (shopping cart, inventory)
- ✅ Practice exercises

**Key Concepts**:
```typescript
// Transform
const doubled = numbers.map(n => n * 2);

// Filter
const inStock = products.filter(p => p.stock > 0);

// Reduce
const total = items.reduce((sum, item) => sum + item.price, 0);

// Immutable add
const newItems = [...items, newItem];

// Immutable remove
const filtered = items.filter(item => item.id !== removeId);
```

**Time**: 1-2 hours

---

### [Part 2: Design Patterns](./LEARNING-GUIDE-PART-2-PATTERNS.md)

**What You'll Learn**:
- ✅ **Factory Pattern** - Control object creation with validation
- ✅ **Repository Pattern** - Abstract data access from domain logic
- ✅ **Strategy Pattern** - Swap algorithms without if-else chains
- ✅ **Observer Pattern** - Decouple components with events
- ✅ **Dependency Injection** - Make code testable and flexible
- ✅ **SOLID Principles** - Write maintainable, extensible code

**Real Examples from Your Code**:
```typescript
// Factory Pattern
const order = Order.create(customerId, items); // ✅ Validated, consistent

// Repository Pattern
await orderRepository.save(order); // ✅ Domain doesn't know about DynamoDB

// Dependency Injection
class CreateOrderUseCase {
  constructor(
    private orderRepository: IOrderRepository,  // ✅ Interface, not concrete
    private catalogClient: ICatalogClient
  ) {}
}
```

**Time**: 2-3 hours

---

### [Part 3: Domain-Driven Design (DDD)](./LEARNING-GUIDE-PART-3-DDD.md)

**What You'll Learn**:
- ✅ **Entities** - Objects with identity (Order, OrderItem)
- ✅ **Value Objects** - Objects defined by attributes (Money, Email)
- ✅ **Aggregates** - Cluster of objects with one root
- ✅ **Domain Events** - Things that happened (OrderCreated, OrderConfirmed)
- ✅ **Repositories** - Persist and retrieve aggregates
- ✅ **Layered Architecture** - Separate concerns properly

**The 4 Golden Rules of Aggregates**:
1. ✅ One root per aggregate
2. ✅ Reference other aggregates by ID only
3. ✅ One transaction per aggregate
4. ✅ Root enforces all business rules

**Real Example**:
```typescript
// Order Aggregate Root
export class Order extends AggregateRoot<OrderProps> {
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  static create(customerId: string, items: OrderItem[]): Order {
    // Business rules enforced here
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    
    const order = new Order({...}, orderId);
    order.addDomainEvent(new OrderCreatedEvent({...}));
    return order;
  }

  confirm(): void {
    // Business logic
    if (!this.status.canTransitionTo(OrderStatus.CONFIRMED)) {
      throw new Error('Cannot confirm order');
    }
    this.props.status = OrderStatus.CONFIRMED;
    this.addDomainEvent(new OrderConfirmedEvent({...}));
  }
}
```

**Time**: 3-4 hours

---

### [Part 4: Practical Exercises](./LEARNING-GUIDE-PART-4-PRACTICE.md)

**What You'll Build**:
- ✅ **Exercise 1**: Product aggregate with stock management
- ✅ **Exercise 2**: Value objects (Email, Address, Quantity)
- ✅ **Exercise 3**: Repository implementations (in-memory + DynamoDB)
- ✅ **Exercise 4**: Complete use case with validation
- ✅ **Exercise 5**: Domain events and handlers
- ✅ **Project**: Complete Shopping Cart service from scratch

**Skills You'll Practice**:
- Building aggregates with business rules
- Creating immutable value objects
- Implementing repositories
- Writing testable use cases
- Emitting and handling domain events

**Final Project - Shopping Cart**:
```typescript
// You'll build this complete service:
const cart = Cart.create('customer-1');
cart.addItem('prod-1', 'Mouse', Money.create(29.99), 2);
cart.applyDiscount(DiscountCode.create('SAVE10', 10, validUntil));
console.log(cart.getTotal()); // Money { amount: 53.98, currency: 'USD' }
cart.checkout(); // Emits CartCheckedOut event
```

**Time**: 4-6 hours

---

## 🎯 Quick Reference

### Key Concepts Cheat Sheet

| Concept | Purpose | Example |
|---------|---------|---------|
| **Private Constructor** | Force factory method usage | `private constructor()` |
| **Static Factory** | Control object creation | `static create()` |
| **Getter** | Read-only property access | `get orderId(): string` |
| **Entity** | Object with identity | `Order`, `OrderItem` |
| **Value Object** | Object by attributes | `Money`, `Email` |
| **Aggregate** | Consistency boundary | `Order` + `OrderItem[]` |
| **Domain Event** | Something that happened | `OrderCreatedEvent` |
| **Repository** | Persist aggregates | `IOrderRepository` |

### Common Patterns

```typescript
// 1. Factory Pattern
class Order {
  private constructor(props: OrderProps, id: string) {}
  static create(customerId: string, items: OrderItem[]): Order {
    // Validation + business rules
    return new Order({...}, id);
  }
}

// 2. Getters (read-only)
get orderId(): string {
  return this.props.orderId;
}

// 3. Value Object (immutable)
class Money extends ValueObject<MoneyProps> {
  add(other: Money): Money {
    return Money.create(this.amount + other.amount); // New instance
  }
}

// 4. Domain Events
this.addDomainEvent(new OrderCreatedEvent({...}));

// 5. Repository Pattern
interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// 6. Dependency Injection
constructor(
  private orderRepository: IOrderRepository,
  private eventPublisher: IEventPublisher
) {}
```

---

## 🗺️ Your Codebase Map

### Where to Find Examples

**Domain Models** (Pure business logic):
```
services/orders-service/src/domain/
├── models/
│   ├── order.ts              ← Aggregate Root example
│   ├── order-item.ts         ← Entity example
│   └── value-objects/
│       ├── money.ts          ← Value Object example
│       └── order-status.ts   ← Enum Value Object
├── events/
│   ├── order-created.event.ts    ← Domain Event
│   └── order-confirmed.event.ts
└── repositories/
    └── order.repository.interface.ts  ← Repository interface
```

**Application Layer** (Use cases):
```
services/orders-service/src/application/
└── use-cases/
    └── create-order.use-case.ts  ← Complete use case example
```

**Infrastructure** (Technical implementation):
```
services/orders-service/src/infrastructure/
├── repositories/
│   └── dynamodb-order.repository.ts  ← Repository implementation
└── http/
    └── catalog-client.ts  ← Anti-Corruption Layer (ACL)
```

**Shared Primitives** (Base classes):
```
shared/domain-primitives/src/
├── entity.ts           ← Base Entity class
├── value-object.ts     ← Base Value Object class
├── aggregate-root.ts   ← Base Aggregate Root class
└── domain-event.ts     ← Base Domain Event class
```

---

## 🎓 Learning Tips

### For Beginners
1. **Start with Part 1** - Don't skip the fundamentals
2. **Type the code** - Don't just read, actually type examples
3. **Run the tests** - See what works and what doesn't
4. **One concept at a time** - Master each before moving on
5. **Ask questions** - Use comments in code to explain to yourself

### For Intermediate Developers
1. **Focus on patterns** - Understand why, not just how
2. **Compare with your experience** - How does this differ from what you know?
3. **Refactor existing code** - Apply new knowledge to old projects
4. **Build the exercises** - Hands-on practice is key

### For Advanced Developers
1. **Study the architecture** - See how patterns combine
2. **Challenge the decisions** - Why this pattern over another?
3. **Extend the examples** - Add new features
4. **Teach others** - Best way to solidify understanding

---

## 🧪 Testing Your Knowledge

### After Part 1
- [ ] Can explain difference between `private`, `public`, `protected`
- [ ] Can write a getter and explain why it's better than a method
- [ ] Can implement a static factory method
- [ ] Can use generics to make code reusable

### After Part 2
- [ ] Can implement Factory pattern
- [ ] Can create a Repository interface and implementation
- [ ] Can explain all 5 SOLID principles with examples
- [ ] Can use Dependency Injection

### After Part 3
- [ ] Can explain difference between Entity and Value Object
- [ ] Can build an Aggregate with business rules
- [ ] Can emit and handle Domain Events
- [ ] Can explain the 4 golden rules of Aggregates

### After Part 4
- [ ] Can build a complete aggregate from scratch
- [ ] Can implement a repository
- [ ] Can create a use case with validation
- [ ] Can build the Shopping Cart project

---

## 📚 Additional Resources

### Your Project Documentation
- [DDD Concepts Explained](./DDD-CONCEPTS-EXPLAINED.md) - Deep dive into DDD
- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [Implementation Guide](./IMPLEMENTATION-GUIDE.md) - How to implement features
- [Cheat Sheet](./CHEAT-SHEET.md) - Quick reference

### External Resources
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/handbook/
- **Domain-Driven Design** by Eric Evans (Blue Book)
- **Implementing Domain-Driven Design** by Vaughn Vernon (Red Book)
- **Clean Architecture** by Robert C. Martin

---

## 🚀 Next Steps After Completing

1. **Build New Features**
   - Add payment processing to Order service
   - Create a Wishlist service
   - Implement product reviews

2. **Refactor Existing Code**
   - Apply new patterns to old projects
   - Improve test coverage
   - Add domain events

3. **Explore Advanced Topics**
   - Event Sourcing
   - CQRS (Command Query Responsibility Segregation)
   - Saga Pattern for distributed transactions
   - Microservices communication patterns

4. **Share Your Knowledge**
   - Write blog posts
   - Create tutorials
   - Mentor others

---

## 💡 Common Questions

### Q: Why use private constructor + static factory?
**A**: To enforce business rules and validation BEFORE the object exists. Prevents invalid objects from being created.

### Q: When to use Entity vs Value Object?
**A**: 
- **Entity**: Has identity, can change over time (Order, User)
- **Value Object**: No identity, immutable, defined by attributes (Money, Email)

### Q: Why separate domain from infrastructure?
**A**: 
- Domain = business logic (should never change because of tech)
- Infrastructure = technical details (can change without affecting business)
- Separation = flexibility and testability

### Q: What's the difference between getter and method?
**A**:
- **Getter**: Access like property, no parentheses, usually simple return
- **Method**: Call with parentheses, can have complex logic

### Q: Why use interfaces for repositories?
**A**: 
- Domain defines what it needs (interface)
- Infrastructure provides implementation
- Easy to swap implementations (DynamoDB → MongoDB)
- Easy to mock for testing

---

## 🎉 Congratulations!

You now have a complete roadmap to master:
- ✅ TypeScript and OOP
- ✅ Design Patterns
- ✅ Domain-Driven Design
- ✅ Building serverless microservices

**Remember**: The best way to learn is by doing. Build the exercises, experiment with the code, and don't be afraid to make mistakes!

---

## 📞 Need Help?

If you get stuck:
1. Review the relevant section
2. Check the real code examples in your project
3. Run the tests to see what works
4. Try to explain the concept to yourself (or a rubber duck!)
5. Take a break and come back with fresh eyes

---

**Happy Learning!** 🚀

Start with: [Part 1: TypeScript & OOP Fundamentals →](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md)
