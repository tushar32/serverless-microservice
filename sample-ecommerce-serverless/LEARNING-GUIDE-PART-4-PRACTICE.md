# 📘 Part 4: Practical Exercises & Building Your Own

> **Learning Path**: [Part 1: TypeScript & OOP](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md) → [Part 2: Design Patterns](./LEARNING-GUIDE-PART-2-PATTERNS.md) → [Part 3: DDD](./LEARNING-GUIDE-PART-3-DDD.md) → Part 4

## Table of Contents
1. [Exercise 1: Build a Product Aggregate](#exercise-1)
2. [Exercise 2: Create Value Objects](#exercise-2)
3. [Exercise 3: Implement Repository](#exercise-3)
4. [Exercise 4: Build a Use Case](#exercise-4)
5. [Exercise 5: Add Domain Events](#exercise-5)
6. [Project: Build a Cart Service](#project)

---

## Exercise 1: Build a Product Aggregate {#exercise-1}

### Goal
Create a `Product` aggregate with business rules

### Requirements
- Product has: id, name, description, price, stock quantity
- Can update price (emit event)
- Can reserve stock (decrease quantity)
- Can release stock (increase quantity)
- Cannot have negative stock

### Step 1: Define Props Interface

```typescript
interface ProductProps {
  productId: string;
  name: string;
  description: string;
  price: Money;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 2: Create Product Aggregate

```typescript
import { AggregateRoot } from '@shared/domain-primitives';
import { Money } from './value-objects/money';

export class Product extends AggregateRoot<ProductProps> {
  
  private constructor(props: ProductProps, id: string) {
    super(props, id);
  }

  // TODO: Implement factory method
  static create(
    name: string,
    description: string,
    price: Money,
    initialStock: number
  ): Product {
    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (initialStock < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    const productId = this.generateId();
    const now = new Date();

    const product = new Product({
      productId,
      name: name.trim(),
      description: description.trim(),
      price,
      stockQuantity: initialStock,
      createdAt: now,
      updatedAt: now
    }, productId);

    // TODO: Add ProductCreatedEvent

    return product;
  }

  // Getters
  get productId(): string {
    return this.props.productId;
  }

  get name(): string {
    return this.props.name;
  }

  get price(): Money {
    return this.props.price;
  }

  get stockQuantity(): number {
    return this.props.stockQuantity;
  }

  get isInStock(): boolean {
    return this.props.stockQuantity > 0;
  }

  // TODO: Implement business methods
  updatePrice(newPrice: Money): void {
    if (newPrice.amount <= 0) {
      throw new Error('Price must be greater than zero');
    }

    const oldPrice = this.props.price;
    this.props.price = newPrice;
    this.props.updatedAt = new Date();

    // TODO: Emit PriceChangedEvent
  }

  reserveStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    if (this.props.stockQuantity < quantity) {
      throw new Error(`Insufficient stock. Available: ${this.props.stockQuantity}`);
    }

    this.props.stockQuantity -= quantity;
    this.props.updatedAt = new Date();

    // TODO: Emit StockReservedEvent
  }

  releaseStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    this.props.stockQuantity += quantity;
    this.props.updatedAt = new Date();

    // TODO: Emit StockReleasedEvent
  }

  replenishStock(quantity: number): void {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero');
    }

    this.props.stockQuantity += quantity;
    this.props.updatedAt = new Date();
  }
}
```

### Step 3: Test Your Product

```typescript
// Create product
const product = Product.create(
  "Wireless Mouse",
  "Ergonomic wireless mouse with USB receiver",
  Money.create(29.99, "USD"),
  100
);

console.log(product.name);          // "Wireless Mouse"
console.log(product.stockQuantity); // 100
console.log(product.isInStock);     // true

// Reserve stock
product.reserveStock(5);
console.log(product.stockQuantity); // 95

// Update price
product.updatePrice(Money.create(24.99, "USD"));
console.log(product.price.amount);  // 24.99

// Try to reserve more than available
try {
  product.reserveStock(200);
} catch (error) {
  console.log(error.message); // "Insufficient stock. Available: 95"
}
```

---

## Exercise 2: Create Value Objects {#exercise-2}

### Goal
Create reusable value objects

### Exercise 2A: Email Value Object

```typescript
import { ValueObject } from '@shared/domain-primitives';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    // TODO: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || !emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: email.toLowerCase().trim() });
  }

  get value(): string {
    return this.props.value;
  }

  getDomain(): string {
    return this.props.value.split('@')[1];
  }

  toString(): string {
    return this.props.value;
  }
}

// Test
const email = Email.create("user@example.com");
console.log(email.value);      // "user@example.com"
console.log(email.getDomain()); // "example.com"
```

### Exercise 2B: Address Value Object

```typescript
interface AddressProps {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export class Address extends ValueObject<AddressProps> {
  
  private constructor(props: AddressProps) {
    super(props);
  }

  static create(
    street: string,
    city: string,
    state: string,
    zipCode: string,
    country: string
  ): Address {
    // TODO: Validate required fields
    if (!street || !city || !state || !zipCode || !country) {
      throw new Error('All address fields are required');
    }

    // TODO: Validate zip code format (US example)
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (!zipRegex.test(zipCode)) {
      throw new Error('Invalid zip code format');
    }

    return new Address({
      street: street.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zipCode: zipCode.trim(),
      country: country.trim().toUpperCase()
    });
  }

  get street(): string {
    return this.props.street;
  }

  get city(): string {
    return this.props.city;
  }

  get fullAddress(): string {
    return `${this.props.street}, ${this.props.city}, ${this.props.state} ${this.props.zipCode}, ${this.props.country}`;
  }

  toString(): string {
    return this.fullAddress;
  }
}

// Test
const address = Address.create(
  "123 Main St",
  "New York",
  "NY",
  "10001",
  "USA"
);
console.log(address.fullAddress);
// "123 Main St, New York, NY 10001, USA"
```

### Exercise 2C: Quantity Value Object

```typescript
interface QuantityProps {
  value: number;
  unit: string;
}

export class Quantity extends ValueObject<QuantityProps> {
  
  private constructor(props: QuantityProps) {
    super(props);
  }

  static create(value: number, unit: string = 'pcs'): Quantity {
    if (value < 0) {
      throw new Error('Quantity cannot be negative');
    }

    if (!Number.isInteger(value)) {
      throw new Error('Quantity must be a whole number');
    }

    return new Quantity({ value, unit: unit.toLowerCase() });
  }

  get value(): number {
    return this.props.value;
  }

  get unit(): string {
    return this.props.unit;
  }

  add(other: Quantity): Quantity {
    if (this.props.unit !== other.props.unit) {
      throw new Error('Cannot add different units');
    }
    return Quantity.create(this.props.value + other.props.value, this.props.unit);
  }

  subtract(other: Quantity): Quantity {
    if (this.props.unit !== other.props.unit) {
      throw new Error('Cannot subtract different units');
    }
    return Quantity.create(this.props.value - other.props.value, this.props.unit);
  }

  toString(): string {
    return `${this.props.value} ${this.props.unit}`;
  }
}
```

---

## Exercise 3: Implement Repository {#exercise-3}

### Goal
Create a repository with in-memory and DynamoDB implementations

### Step 1: Define Repository Interface

```typescript
export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  delete(id: string): Promise<void>;
  findByName(name: string): Promise<Product[]>;
  findInStock(): Promise<Product[]>;
}
```

### Step 2: In-Memory Implementation (for testing)

```typescript
export class InMemoryProductRepository implements IProductRepository {
  private products: Map<string, Product> = new Map();

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) || null;
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.productId, product);
  }

  async delete(id: string): Promise<void> {
    this.products.delete(id);
  }

  async findByName(name: string): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
  }

  async findInStock(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(p => p.isInStock);
  }

  // Helper for testing
  clear(): void {
    this.products.clear();
  }
}
```

### Step 3: DynamoDB Implementation

```typescript
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

export class DynamoDBProductRepository implements IProductRepository {
  constructor(
    private dynamodb: DynamoDBClient,
    private tableName: string = 'Products'
  ) {}

  async findById(id: string): Promise<Product | null> {
    const result = await this.dynamodb.send(new GetItemCommand({
      TableName: this.tableName,
      Key: { productId: { S: id } }
    }));

    if (!result.Item) return null;

    // Map DynamoDB item to Product
    return Product.reconstitute({
      productId: result.Item.productId.S!,
      name: result.Item.name.S!,
      description: result.Item.description.S!,
      price: Money.create(
        parseFloat(result.Item.price.N!),
        result.Item.currency.S!
      ),
      stockQuantity: parseInt(result.Item.stockQuantity.N!),
      createdAt: new Date(result.Item.createdAt.S!),
      updatedAt: new Date(result.Item.updatedAt.S!)
    });
  }

  async save(product: Product): Promise<void> {
    await this.dynamodb.send(new PutItemCommand({
      TableName: this.tableName,
      Item: {
        productId: { S: product.productId },
        name: { S: product.name },
        description: { S: product.description },
        price: { N: product.price.amount.toString() },
        currency: { S: product.price.currency },
        stockQuantity: { N: product.stockQuantity.toString() },
        createdAt: { S: product.createdAt.toISOString() },
        updatedAt: { S: product.updatedAt.toISOString() }
      }
    }));
  }

  // TODO: Implement other methods
}
```

### Step 4: Test Repository

```typescript
describe('ProductRepository', () => {
  let repository: IProductRepository;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
  });

  it('should save and retrieve product', async () => {
    const product = Product.create(
      "Mouse",
      "Wireless mouse",
      Money.create(29.99, "USD"),
      100
    );

    await repository.save(product);
    const retrieved = await repository.findById(product.productId);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("Mouse");
    expect(retrieved!.stockQuantity).toBe(100);
  });

  it('should find products by name', async () => {
    const mouse = Product.create("Wireless Mouse", "...", Money.create(29.99), 100);
    const keyboard = Product.create("Wireless Keyboard", "...", Money.create(79.99), 50);

    await repository.save(mouse);
    await repository.save(keyboard);

    const results = await repository.findByName("wireless");
    expect(results.length).toBe(2);
  });
});
```

---

## Exercise 4: Build a Use Case {#exercise-4}

### Goal
Create a complete use case with validation and error handling

### Step 1: Define DTOs

```typescript
// Input DTO
export interface CreateProductDTO {
  name: string;
  description: string;
  price: number;
  currency: string;
  initialStock: number;
}

// Output DTO
export interface ProductResponseDTO {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  isInStock: boolean;
  createdAt: string;
}
```

### Step 2: Implement Use Case

```typescript
export class CreateProductUseCase {
  constructor(
    private productRepository: IProductRepository,
    private eventPublisher: IEventPublisher
  ) {}

  async execute(dto: CreateProductDTO): Promise<ProductResponseDTO> {
    // Step 1: Validate input
    this.validateInput(dto);

    // Step 2: Check if product name already exists
    const existing = await this.productRepository.findByName(dto.name);
    if (existing.length > 0) {
      throw new Error(`Product with name "${dto.name}" already exists`);
    }

    // Step 3: Create Money value object
    const price = Money.create(dto.price, dto.currency);

    // Step 4: Create Product aggregate
    const product = Product.create(
      dto.name,
      dto.description,
      price,
      dto.initialStock
    );

    // Step 5: Save to repository
    await this.productRepository.save(product);

    // Step 6: Publish domain events
    for (const event of product.domainEvents) {
      await this.eventPublisher.publish(event);
    }
    product.clearEvents();

    // Step 7: Return DTO
    return this.toDTO(product);
  }

  private validateInput(dto: CreateProductDTO): void {
    if (!dto.name || dto.name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (dto.price <= 0) {
      throw new Error('Price must be greater than zero');
    }

    if (dto.initialStock < 0) {
      throw new Error('Initial stock cannot be negative');
    }

    if (!dto.currency || dto.currency.length !== 3) {
      throw new Error('Currency must be a 3-letter ISO code');
    }
  }

  private toDTO(product: Product): ProductResponseDTO {
    return {
      productId: product.productId,
      name: product.name,
      description: product.description,
      price: product.price.amount,
      currency: product.price.currency,
      stockQuantity: product.stockQuantity,
      isInStock: product.isInStock,
      createdAt: product.createdAt.toISOString()
    };
  }
}
```

### Step 3: Test Use Case

```typescript
describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase;
  let repository: InMemoryProductRepository;
  let eventPublisher: MockEventPublisher;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
    eventPublisher = new MockEventPublisher();
    useCase = new CreateProductUseCase(repository, eventPublisher);
  });

  it('should create product successfully', async () => {
    const dto: CreateProductDTO = {
      name: "Wireless Mouse",
      description: "Ergonomic mouse",
      price: 29.99,
      currency: "USD",
      initialStock: 100
    };

    const result = await useCase.execute(dto);

    expect(result.productId).toBeDefined();
    expect(result.name).toBe("Wireless Mouse");
    expect(result.price).toBe(29.99);
    expect(result.stockQuantity).toBe(100);
    expect(result.isInStock).toBe(true);
  });

  it('should throw error for invalid price', async () => {
    const dto: CreateProductDTO = {
      name: "Mouse",
      description: "...",
      price: -10,
      currency: "USD",
      initialStock: 100
    };

    await expect(useCase.execute(dto)).rejects.toThrow('Price must be greater than zero');
  });

  it('should publish domain events', async () => {
    const dto: CreateProductDTO = {
      name: "Mouse",
      description: "...",
      price: 29.99,
      currency: "USD",
      initialStock: 100
    };

    await useCase.execute(dto);

    expect(eventPublisher.publishedEvents.length).toBe(1);
    expect(eventPublisher.publishedEvents[0].constructor.name).toBe('ProductCreatedEvent');
  });
});
```

---

## Exercise 5: Add Domain Events {#exercise-5}

### Goal
Implement domain events for Product aggregate

### Step 1: Create Event Classes

```typescript
import { DomainEvent } from '@shared/domain-primitives';

export class ProductCreatedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      productId: string;
      name: string;
      price: number;
      currency: string;
      stockQuantity: number;
    }
  ) {
    super();
  }
}

export class PriceChangedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      productId: string;
      oldPrice: number;
      newPrice: number;
      currency: string;
    }
  ) {
    super();
  }
}

export class StockReservedEvent extends DomainEvent {
  constructor(
    public readonly payload: {
      productId: string;
      quantity: number;
      remainingStock: number;
    }
  ) {
    super();
  }
}
```

### Step 2: Update Product Aggregate

```typescript
export class Product extends AggregateRoot<ProductProps> {
  
  static create(...): Product {
    const product = new Product({...}, productId);

    // Emit event
    product.addDomainEvent(new ProductCreatedEvent({
      productId: product.productId,
      name: product.name,
      price: product.price.amount,
      currency: product.price.currency,
      stockQuantity: product.stockQuantity
    }));

    return product;
  }

  updatePrice(newPrice: Money): void {
    const oldPrice = this.props.price;
    this.props.price = newPrice;
    this.props.updatedAt = new Date();

    // Emit event
    this.addDomainEvent(new PriceChangedEvent({
      productId: this.productId,
      oldPrice: oldPrice.amount,
      newPrice: newPrice.amount,
      currency: newPrice.currency
    }));
  }

  reserveStock(quantity: number): void {
    if (this.props.stockQuantity < quantity) {
      throw new Error('Insufficient stock');
    }

    this.props.stockQuantity -= quantity;
    this.props.updatedAt = new Date();

    // Emit event
    this.addDomainEvent(new StockReservedEvent({
      productId: this.productId,
      quantity,
      remainingStock: this.props.stockQuantity
    }));
  }
}
```

### Step 3: Create Event Handlers

```typescript
export class SendPriceChangeNotificationHandler {
  async handle(event: PriceChangedEvent): Promise<void> {
    console.log(`Price changed for product ${event.payload.productId}`);
    console.log(`Old: ${event.payload.oldPrice}, New: ${event.payload.newPrice}`);
    
    // TODO: Send email notification to subscribers
    // TODO: Update cache
    // TODO: Notify analytics service
  }
}

export class UpdateInventoryHandler {
  async handle(event: StockReservedEvent): Promise<void> {
    console.log(`Stock reserved: ${event.payload.quantity} units`);
    console.log(`Remaining: ${event.payload.remainingStock}`);
    
    // TODO: Update inventory system
    // TODO: Check if reorder needed
  }
}
```

---

## Project: Build a Shopping Cart Service {#project}

### Goal
Build a complete shopping cart aggregate from scratch

### Requirements

1. **Cart Aggregate**
   - Add items to cart
   - Remove items from cart
   - Update item quantity
   - Calculate total
   - Clear cart
   - Apply discount codes

2. **CartItem Entity**
   - Product reference (by ID)
   - Quantity
   - Price at time of adding

3. **Value Objects**
   - DiscountCode (code, percentage, validUntil)
   - CartTotal (subtotal, discount, tax, total)

4. **Domain Events**
   - CartCreated
   - ItemAddedToCart
   - ItemRemovedFromCart
   - DiscountApplied
   - CartCheckedOut

5. **Use Cases**
   - CreateCartUseCase
   - AddItemToCartUseCase
   - RemoveItemFromCartUseCase
   - ApplyDiscountUseCase
   - CheckoutCartUseCase

### Starter Code

```typescript
// 1. Cart Item Entity
interface CartItemProps {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export class CartItem extends Entity<CartItemProps> {
  // TODO: Implement
}

// 2. Discount Code Value Object
interface DiscountCodeProps {
  code: string;
  percentage: number;
  validUntil: Date;
}

export class DiscountCode extends ValueObject<DiscountCodeProps> {
  // TODO: Implement
  
  isValid(): boolean {
    return new Date() <= this.props.validUntil;
  }

  calculateDiscount(amount: Money): Money {
    return amount.multiply(this.props.percentage / 100);
  }
}

// 3. Cart Aggregate
interface CartProps {
  cartId: string;
  customerId: string;
  items: CartItem[];
  discountCode?: DiscountCode;
  createdAt: Date;
  updatedAt: Date;
}

export class Cart extends AggregateRoot<CartProps> {
  
  private constructor(props: CartProps, id: string) {
    super(props, id);
  }

  static create(customerId: string): Cart {
    // TODO: Implement
  }

  addItem(productId: string, productName: string, price: Money, quantity: number): void {
    // TODO: Check if item already exists
    // TODO: If exists, update quantity
    // TODO: If not, add new item
    // TODO: Emit ItemAddedToCart event
  }

  removeItem(productId: string): void {
    // TODO: Implement
  }

  updateItemQuantity(productId: string, newQuantity: number): void {
    // TODO: Implement
  }

  applyDiscount(code: DiscountCode): void {
    // TODO: Validate discount code
    // TODO: Apply discount
    // TODO: Emit DiscountApplied event
  }

  getSubtotal(): Money {
    // TODO: Calculate sum of all line totals
  }

  getDiscount(): Money {
    // TODO: Calculate discount if code applied
  }

  getTotal(): Money {
    // TODO: Calculate subtotal - discount
  }

  clear(): void {
    // TODO: Remove all items
  }

  checkout(): void {
    // TODO: Validate cart has items
    // TODO: Emit CartCheckedOut event
  }
}
```

### Implementation Tips

1. **Start with tests** - Write tests first, then implement
2. **One method at a time** - Don't try to implement everything at once
3. **Follow patterns** - Use the same patterns as Order aggregate
4. **Emit events** - Don't forget domain events
5. **Validate everything** - Check business rules

### Testing Your Cart

```typescript
describe('Cart', () => {
  it('should create empty cart', () => {
    const cart = Cart.create('customer-1');
    expect(cart.items.length).toBe(0);
    expect(cart.getTotal().amount).toBe(0);
  });

  it('should add item to cart', () => {
    const cart = Cart.create('customer-1');
    cart.addItem('prod-1', 'Mouse', Money.create(29.99), 1);
    
    expect(cart.items.length).toBe(1);
    expect(cart.getTotal().amount).toBe(29.99);
  });

  it('should update quantity if item already exists', () => {
    const cart = Cart.create('customer-1');
    cart.addItem('prod-1', 'Mouse', Money.create(29.99), 1);
    cart.addItem('prod-1', 'Mouse', Money.create(29.99), 2);
    
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  it('should apply discount code', () => {
    const cart = Cart.create('customer-1');
    cart.addItem('prod-1', 'Mouse', Money.create(100), 1);
    
    const discount = DiscountCode.create('SAVE10', 10, new Date('2025-12-31'));
    cart.applyDiscount(discount);
    
    expect(cart.getSubtotal().amount).toBe(100);
    expect(cart.getDiscount().amount).toBe(10);
    expect(cart.getTotal().amount).toBe(90);
  });
});
```

---

## Learning Checklist

### TypeScript & OOP
- [ ] Understand access modifiers (private, public, protected)
- [ ] Know when to use getters vs methods
- [ ] Understand static methods and factory pattern
- [ ] Can use generics effectively
- [ ] Understand interfaces vs types

### Design Patterns
- [ ] Can implement Factory pattern
- [ ] Can implement Repository pattern
- [ ] Can implement Strategy pattern
- [ ] Understand Dependency Injection
- [ ] Know SOLID principles

### DDD
- [ ] Understand difference between Entity and Value Object
- [ ] Can build Aggregates with business rules
- [ ] Can emit and handle Domain Events
- [ ] Understand layered architecture
- [ ] Can separate domain from infrastructure

### Practical Skills
- [ ] Can build a complete aggregate from scratch
- [ ] Can write testable code
- [ ] Can implement repositories
- [ ] Can create use cases
- [ ] Can handle domain events

---

## Next Steps

1. **Complete the Cart Project** - Build it from scratch
2. **Add More Features** - Implement wishlist, reviews, ratings
3. **Study Real Code** - Read through your existing Order service
4. **Refactor** - Improve existing code using new knowledge
5. **Build New Services** - Create payment service, notification service

---

## Resources

### Your Codebase
- `services/orders-service/src/domain/models/order.ts` - Complete aggregate example
- `services/orders-service/src/domain/models/order-item.ts` - Entity example
- `services/orders-service/src/domain/models/value-objects/money.ts` - Value object example
- `shared/domain-primitives/` - Base classes

### Documentation
- [DDD Concepts Explained](./DDD-CONCEPTS-EXPLAINED.md)
- [Architecture](./ARCHITECTURE.md)
- [Implementation Guide](./IMPLEMENTATION-GUIDE.md)

---

**Congratulations!** 🎉

You now have a complete understanding of:
- TypeScript and OOP fundamentals
- Design patterns used in your codebase
- DDD tactical patterns
- How to build your own domain models

Keep practicing and building! The best way to learn is by doing.

---

**Learning Path**: [Part 1: TypeScript & OOP](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md) → [Part 2: Design Patterns](./LEARNING-GUIDE-PART-2-PATTERNS.md) → [Part 3: DDD](./LEARNING-GUIDE-PART-3-DDD.md) → Part 4
