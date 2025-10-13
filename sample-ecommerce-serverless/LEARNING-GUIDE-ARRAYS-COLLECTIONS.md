# 📘 Arrays & Collections in TypeScript

> **Supplement to**: [Part 1: TypeScript & OOP](./LEARNING-GUIDE-PART-1-TYPESCRIPT-OOP.md)

## Table of Contents
1. [Array Basics](#array-basics)
2. [Essential Array Methods](#array-methods)
3. [Immutable Operations](#immutable-operations)
4. [Working with Object Arrays](#working-with-objects)
5. [Real-World Examples](#real-world-examples)
6. [Practice Exercises](#practice-exercises)

---

## 1. Array Basics {#array-basics}

### Creating Arrays

```typescript
// Empty arrays
const items: string[] = [];
const numbers: Array<number> = [];

// With initial values
const fruits = ["apple", "banana", "orange"];
const prices = [10.99, 20.50, 15.75];

// Array of objects
interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: "1", name: "Mouse", price: 29.99 },
  { id: "2", name: "Keyboard", price: 79.99 }
];
```

### Array Properties

```typescript
const items = ["a", "b", "c"];

console.log(items.length);              // 3
console.log(items[0]);                  // "a"
console.log(items[items.length - 1]);   // "c" (last item)

// Check if empty
if (items.length === 0) {
  console.log("Empty");
}
```

---

## 2. Essential Array Methods {#array-methods}

### Adding/Removing Items

```typescript
const items = ["a", "b", "c"];

// Add to end
items.push("d");              // ["a", "b", "c", "d"]

// Remove from end
const last = items.pop();     // "d"

// Add to beginning
items.unshift("z");           // ["z", "a", "b", "c"]

// Remove from beginning
const first = items.shift();  // "z"
```

### Searching

```typescript
const numbers = [1, 2, 3, 4, 5];

// indexOf
const index = numbers.indexOf(3);     // 2

// includes
const hasThree = numbers.includes(3); // true

// find - first matching item
const products = [
  { id: "1", name: "Mouse", price: 29.99 },
  { id: "2", name: "Keyboard", price: 79.99 }
];

const mouse = products.find(p => p.id === "1");
// { id: "1", name: "Mouse", price: 29.99 }

// findIndex
const index = products.findIndex(p => p.id === "1"); // 0

// some - at least one matches
const hasExpensive = products.some(p => p.price > 50); // true

// every - all match
const allExpensive = products.every(p => p.price > 50); // false
```

### Transforming

```typescript
const numbers = [1, 2, 3, 4, 5];

// map - transform each item
const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

// filter - keep matching items
const evens = numbers.filter(n => n % 2 === 0);
// [2, 4]

// reduce - combine into single value
const sum = numbers.reduce((total, n) => total + n, 0);
// 15

// Real example: calculate total price
const products = [
  { name: "Mouse", price: 29.99 },
  { name: "Keyboard", price: 79.99 }
];

const total = products.reduce((sum, p) => sum + p.price, 0);
// 109.98
```

### Sorting

```typescript
const numbers = [3, 1, 4, 1, 5, 9];

// Ascending
numbers.sort((a, b) => a - b);
// [1, 1, 3, 4, 5, 9]

// Descending
numbers.sort((a, b) => b - a);
// [9, 5, 4, 3, 1, 1]

// Sort objects by property
products.sort((a, b) => a.price - b.price);
products.sort((a, b) => a.name.localeCompare(b.name));
```

---

## 3. Immutable Operations {#immutable-operations}

### Why Immutability?

```typescript
// ❌ Bad: Returns reference
class Order {
  private items: OrderItem[];

  getItems(): OrderItem[] {
    return this.items; // Dangerous!
  }
}

// ✅ Good: Returns copy
class Order {
  private items: OrderItem[];

  getItems(): OrderItem[] {
    return [...this.items]; // Safe copy
  }
}
```

### Immutable Patterns

```typescript
const original = [1, 2, 3];

// Add (immutable)
const withFour = [...original, 4];
// original = [1, 2, 3]
// withFour = [1, 2, 3, 4]

// Remove (immutable)
const withoutTwo = original.filter(n => n !== 2);
// original = [1, 2, 3]
// withoutTwo = [1, 3]

// Update (immutable)
const doubled = original.map(n => n === 2 ? n * 2 : n);
// original = [1, 2, 3]
// doubled = [1, 4, 3]
```

### Real Example

```typescript
// From your Order aggregate
export class Order {
  
  get items(): OrderItem[] {
    return [...this.props.items]; // Copy
  }

  addItem(item: OrderItem): void {
    this.props.items = [...this.props.items, item];
  }

  removeItem(productId: string): void {
    this.props.items = this.props.items.filter(
      item => item.productId !== productId
    );
  }
}
```

---

## 4. Working with Object Arrays {#working-with-objects}

### Common Operations

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
}

const products: Product[] = [
  { id: "1", name: "Mouse", price: 29.99, inStock: true },
  { id: "2", name: "Keyboard", price: 79.99, inStock: false }
];

// Find by ID
const findById = (id: string) => products.find(p => p.id === id);

// Filter in stock
const available = products.filter(p => p.inStock);

// Get all names
const names = products.map(p => p.name);

// Calculate total
const total = products.reduce((sum, p) => sum + p.price, 0);

// Update price (immutable)
const updatePrice = (id: string, newPrice: number) =>
  products.map(p => p.id === id ? { ...p, price: newPrice } : p);

// Remove product (immutable)
const removeProduct = (id: string) =>
  products.filter(p => p.id !== id);
```

### Chaining Operations

```typescript
// Get names of in-stock items under $50
const result = products
  .filter(p => p.inStock)
  .filter(p => p.price < 50)
  .map(p => p.name);
```

---

## 5. Real-World Examples {#real-world-examples}

### Shopping Cart

```typescript
interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

class ShoppingCart {
  private items: CartItem[] = [];

  addItem(productId: string, price: number, quantity: number): void {
    const existing = this.items.find(i => i.productId === productId);

    if (existing) {
      // Update quantity
      this.items = this.items.map(i =>
        i.productId === productId
          ? { ...i, quantity: i.quantity + quantity }
          : i
      );
    } else {
      // Add new
      this.items = [...this.items, { productId, price, quantity }];
    }
  }

  removeItem(productId: string): void {
    this.items = this.items.filter(i => i.productId !== productId);
  }

  getTotal(): number {
    return this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  }

  getItems(): CartItem[] {
    return [...this.items];
  }
}
```

---

## 6. Practice Exercises {#practice-exercises}

### Exercise 1: Basic Operations

```typescript
// Implement these functions

function sum(numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

// Test
console.log(sum([1, 2, 3]));           // 6
console.log(average([1, 2, 3]));       // 2
console.log(unique([1, 2, 2, 3]));     // [1, 2, 3]
```

### Exercise 2: Product Manager

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

class ProductManager {
  constructor(private products: Product[]) {}

  getInStock(): Product[] {
    return this.products.filter(p => p.stock > 0);
  }

  getTotalValue(): number {
    return this.products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  }

  getCheapest(): Product | undefined {
    if (this.products.length === 0) return undefined;
    return this.products.reduce((min, p) => p.price < min.price ? p : min);
  }

  updateStock(id: string, newStock: number): ProductManager {
    const updated = this.products.map(p =>
      p.id === id ? { ...p, stock: newStock } : p
    );
    return new ProductManager(updated);
  }
}
```

---

## 7. Advanced Patterns for Real Projects {#advanced-patterns}

### Pattern 1: Group By (Create Object from Array)

```typescript
// Group products by category
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

const products: Product[] = [
  { id: "1", name: "Mouse", category: "electronics", price: 29.99 },
  { id: "2", name: "Desk", category: "furniture", price: 199.99 },
  { id: "3", name: "Keyboard", category: "electronics", price: 79.99 }
];

// Group by category
const groupByCategory = (products: Product[]) => {
  return products.reduce((groups, product) => {
    const category = product.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(product);
    return groups;
  }, {} as Record<string, Product[]>);
};

const grouped = groupByCategory(products);
// {
//   electronics: [Mouse, Keyboard],
//   furniture: [Desk]
// }

// Generic groupBy function
function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

// Usage
const byCategory = groupBy(products, p => p.category);
const byPrice = groupBy(products, p => p.price > 100 ? 'expensive' : 'cheap');
```

### Pattern 2: Array to Map (Fast Lookups)

```typescript
// Convert array to Map for O(1) lookups
const products: Product[] = [...];

// Create Map by ID
const productMap = new Map(
  products.map(p => [p.id, p])
);

// Fast lookup
const product = productMap.get("1"); // O(1) instead of O(n)

// Helper function
function arrayToMap<T, K>(
  array: T[],
  keyFn: (item: T) => K
): Map<K, T> {
  return new Map(array.map(item => [keyFn(item), item]));
}

// Usage
const byId = arrayToMap(products, p => p.id);
const byName = arrayToMap(products, p => p.name);
```

### Pattern 3: Flatten Nested Arrays

```typescript
// Flatten array of arrays
const orders = [
  { id: "1", items: [{ productId: "p1" }, { productId: "p2" }] },
  { id: "2", items: [{ productId: "p3" }] }
];

// Get all product IDs
const allProductIds = orders.flatMap(order => 
  order.items.map(item => item.productId)
);
// ["p1", "p2", "p3"]

// Alternative with reduce
const allProductIds2 = orders.reduce((ids, order) => {
  return [...ids, ...order.items.map(item => item.productId)];
}, [] as string[]);
```

### Pattern 4: Partition Array (Split into Two)

```typescript
// Split array into two based on condition
function partition<T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  return array.reduce(
    ([pass, fail], item) => {
      return predicate(item)
        ? [[...pass, item], fail]
        : [pass, [...fail, item]];
    },
    [[], []] as [T[], T[]]
  );
}

// Usage
const [inStock, outOfStock] = partition(
  products,
  p => p.stock > 0
);

const [expensive, cheap] = partition(
  products,
  p => p.price > 100
);
```

### Pattern 5: Chunk Array (Split into Batches)

```typescript
// Split array into chunks of specified size
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Usage - process items in batches
const products = [...]; // 100 products
const batches = chunk(products, 25); // 4 batches of 25

// Process each batch
for (const batch of batches) {
  await processBatch(batch);
}

// Real example: DynamoDB batch write (max 25 items)
const items = [...]; // Many items
const batches = chunk(items, 25);

for (const batch of batches) {
  await dynamodb.batchWriteItem({
    RequestItems: {
      'Products': batch.map(item => ({
        PutRequest: { Item: item }
      }))
    }
  });
}
```

### Pattern 6: Unique By Property

```typescript
// Remove duplicates based on property
function uniqueBy<T, K>(
  array: T[],
  keyFn: (item: T) => K
): T[] {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Usage
const orders = [
  { id: "1", customerId: "c1", total: 100 },
  { id: "2", customerId: "c2", total: 200 },
  { id: "3", customerId: "c1", total: 150 }
];

const uniqueCustomers = uniqueBy(orders, o => o.customerId);
// [{ id: "1", customerId: "c1", ... }, { id: "2", customerId: "c2", ... }]
```

### Pattern 7: Merge Arrays by Key

```typescript
// Merge two arrays by matching key
function mergeByKey<T extends Record<string, any>>(
  array1: T[],
  array2: T[],
  key: keyof T
): T[] {
  const map = new Map(array2.map(item => [item[key], item]));
  
  return array1.map(item => {
    const match = map.get(item[key]);
    return match ? { ...item, ...match } : item;
  });
}

// Usage - enrich products with inventory data
const products = [
  { id: "1", name: "Mouse", price: 29.99 },
  { id: "2", name: "Keyboard", price: 79.99 }
];

const inventory = [
  { id: "1", stock: 100, warehouse: "A" },
  { id: "2", stock: 50, warehouse: "B" }
];

const enriched = mergeByKey(products, inventory, 'id');
// [
//   { id: "1", name: "Mouse", price: 29.99, stock: 100, warehouse: "A" },
//   { id: "2", name: "Keyboard", price: 79.99, stock: 50, warehouse: "B" }
// ]
```

### Pattern 8: Aggregate Statistics

```typescript
// Calculate multiple statistics in one pass
interface Stats {
  count: number;
  sum: number;
  min: number;
  max: number;
  average: number;
}

function calculateStats(numbers: number[]): Stats {
  if (numbers.length === 0) {
    return { count: 0, sum: 0, min: 0, max: 0, average: 0 };
  }

  const stats = numbers.reduce(
    (acc, num) => ({
      count: acc.count + 1,
      sum: acc.sum + num,
      min: Math.min(acc.min, num),
      max: Math.max(acc.max, num)
    }),
    { count: 0, sum: 0, min: Infinity, max: -Infinity }
  );

  return {
    ...stats,
    average: stats.sum / stats.count
  };
}

// Usage
const prices = [29.99, 79.99, 199.99, 49.99];
const stats = calculateStats(prices);
// { count: 4, sum: 359.96, min: 29.99, max: 199.99, average: 89.99 }
```

### Pattern 9: Conditional Chaining

```typescript
// Build query with optional filters
class ProductQuery {
  constructor(private products: Product[]) {}

  filter(predicate: (p: Product) => boolean): ProductQuery {
    return new ProductQuery(this.products.filter(predicate));
  }

  filterIf(
    condition: boolean,
    predicate: (p: Product) => boolean
  ): ProductQuery {
    return condition ? this.filter(predicate) : this;
  }

  sort(compareFn: (a: Product, b: Product) => number): ProductQuery {
    return new ProductQuery([...this.products].sort(compareFn));
  }

  take(count: number): ProductQuery {
    return new ProductQuery(this.products.slice(0, count));
  }

  getResults(): Product[] {
    return this.products;
  }
}

// Usage with dynamic filters
function searchProducts(
  products: Product[],
  filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
  }
) {
  return new ProductQuery(products)
    .filterIf(!!filters.category, p => p.category === filters.category!)
    .filterIf(!!filters.minPrice, p => p.price >= filters.minPrice!)
    .filterIf(!!filters.maxPrice, p => p.price <= filters.maxPrice!)
    .filterIf(!!filters.inStockOnly, p => p.stock > 0)
    .sort((a, b) => a.price - b.price)
    .getResults();
}
```

### Pattern 10: Async Array Operations

```typescript
// Process array items with async operations
async function mapAsync<T, U>(
  array: T[],
  asyncFn: (item: T) => Promise<U>
): Promise<U[]> {
  return Promise.all(array.map(asyncFn));
}

async function filterAsync<T>(
  array: T[],
  asyncPredicate: (item: T) => Promise<boolean>
): Promise<T[]> {
  const results = await Promise.all(
    array.map(async item => ({
      item,
      pass: await asyncPredicate(item)
    }))
  );
  return results.filter(r => r.pass).map(r => r.item);
}

// Usage - enrich products with external data
const productIds = ["1", "2", "3"];

const products = await mapAsync(productIds, async id => {
  const product = await fetchProduct(id);
  const reviews = await fetchReviews(id);
  return { ...product, reviews };
});

// Filter products with async check
const availableProducts = await filterAsync(products, async product => {
  const inventory = await checkInventory(product.id);
  return inventory.available;
});

// Sequential processing (when order matters)
async function mapSequential<T, U>(
  array: T[],
  asyncFn: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];
  for (const item of array) {
    results.push(await asyncFn(item));
  }
  return results;
}
```

---

## 8. Real Project Examples {#real-project-examples}

### Example 1: E-commerce Order Processing

```typescript
interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  total: number;
  createdAt: Date;
}

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

class OrderAnalytics {
  constructor(private orders: Order[]) {}

  // Get revenue by customer
  getRevenueByCustomer(): Map<string, number> {
    const revenue = this.orders.reduce((map, order) => {
      const current = map.get(order.customerId) || 0;
      map.set(order.customerId, current + order.total);
      return map;
    }, new Map<string, number>());
    
    return revenue;
  }

  // Get top selling products
  getTopProducts(limit: number): Array<{ productId: string; quantity: number; revenue: number }> {
    // Flatten all items from all orders
    const allItems = this.orders.flatMap(order => order.items);
    
    // Group by product
    const productStats = allItems.reduce((stats, item) => {
      const existing = stats.get(item.productId) || { quantity: 0, revenue: 0 };
      stats.set(item.productId, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.price * item.quantity)
      });
      return stats;
    }, new Map<string, { quantity: number; revenue: number }>());
    
    // Convert to array and sort
    return Array.from(productStats.entries())
      .map(([productId, stats]) => ({ productId, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // Get orders by date range
  getOrdersByDateRange(startDate: Date, endDate: Date): Order[] {
    return this.orders.filter(order =>
      order.createdAt >= startDate && order.createdAt <= endDate
    );
  }

  // Calculate daily revenue
  getDailyRevenue(): Map<string, number> {
    return this.orders.reduce((map, order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      const current = map.get(date) || 0;
      map.set(date, current + order.total);
      return map;
    }, new Map<string, number>());
  }

  // Get customer lifetime value
  getCustomerLifetimeValue(): Array<{ customerId: string; totalSpent: number; orderCount: number }> {
    const customerData = this.orders.reduce((map, order) => {
      const existing = map.get(order.customerId) || { totalSpent: 0, orderCount: 0 };
      map.set(order.customerId, {
        totalSpent: existing.totalSpent + order.total,
        orderCount: existing.orderCount + 1
      });
      return map;
    }, new Map<string, { totalSpent: number; orderCount: number }>());

    return Array.from(customerData.entries())
      .map(([customerId, data]) => ({ customerId, ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }
}
```

### Example 2: Inventory Management System

```typescript
interface InventoryItem {
  productId: string;
  productName: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  lastRestocked: Date;
}

class InventoryManager {
  constructor(private inventory: InventoryItem[]) {}

  // Get items that need reordering
  getReorderList(): InventoryItem[] {
    return this.inventory
      .filter(item => item.quantity <= item.reorderLevel)
      .sort((a, b) => a.quantity - b.quantity);
  }

  // Calculate total inventory value
  getTotalValue(): number {
    return this.inventory.reduce(
      (total, item) => total + (item.quantity * item.unitCost),
      0
    );
  }

  // Get ABC analysis (Pareto principle)
  getABCAnalysis(): {
    A: InventoryItem[];  // Top 20% by value
    B: InventoryItem[];  // Next 30% by value
    C: InventoryItem[];  // Remaining 50%
  } {
    // Calculate value for each item
    const itemsWithValue = this.inventory.map(item => ({
      ...item,
      totalValue: item.quantity * item.unitCost
    }));

    // Sort by value descending
    const sorted = itemsWithValue.sort((a, b) => b.totalValue - a.totalValue);

    const total = sorted.length;
    const aCount = Math.ceil(total * 0.2);
    const bCount = Math.ceil(total * 0.3);

    return {
      A: sorted.slice(0, aCount),
      B: sorted.slice(aCount, aCount + bCount),
      C: sorted.slice(aCount + bCount)
    };
  }

  // Get slow-moving items (not restocked in X days)
  getSlowMovingItems(days: number): InventoryItem[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.inventory.filter(
      item => item.lastRestocked < cutoffDate
    );
  }

  // Batch update stock levels
  batchUpdateStock(updates: Array<{ productId: string; quantity: number }>): InventoryManager {
    const updateMap = new Map(updates.map(u => [u.productId, u.quantity]));

    const updated = this.inventory.map(item => {
      const newQuantity = updateMap.get(item.productId);
      return newQuantity !== undefined
        ? { ...item, quantity: newQuantity, lastRestocked: new Date() }
        : item;
    });

    return new InventoryManager(updated);
  }
}
```

### Example 3: Shopping Cart with Promotions

```typescript
interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Promotion {
  id: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle';
  applies: (item: CartItem) => boolean;
  calculate: (items: CartItem[]) => number;
}

class AdvancedCart {
  constructor(
    private items: CartItem[] = [],
    private promotions: Promotion[] = []
  ) {}

  addItem(productId: string, productName: string, unitPrice: number, quantity: number): AdvancedCart {
    const existing = this.items.find(i => i.productId === productId);

    const newItems = existing
      ? this.items.map(i =>
          i.productId === productId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      : [...this.items, { productId, productName, quantity, unitPrice }];

    return new AdvancedCart(newItems, this.promotions);
  }

  getSubtotal(): number {
    return this.items.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantity),
      0
    );
  }

  getDiscount(): number {
    return this.promotions.reduce(
      (total, promo) => total + promo.calculate(this.items),
      0
    );
  }

  getTotal(): number {
    return this.getSubtotal() - this.getDiscount();
  }

  // Group items by category for display
  groupByCategory(categoryMap: Map<string, string>): Map<string, CartItem[]> {
    return this.items.reduce((groups, item) => {
      const category = categoryMap.get(item.productId) || 'Other';
      const items = groups.get(category) || [];
      groups.set(category, [...items, item]);
      return groups;
    }, new Map<string, CartItem[]>());
  }

  // Get items eligible for promotion
  getPromotionEligibleItems(): CartItem[] {
    return this.items.filter(item =>
      this.promotions.some(promo => promo.applies(item))
    );
  }
}
```

---

## Quick Reference

### Common Patterns

```typescript
// Add item
[...array, newItem]

// Remove item
array.filter(item => item.id !== removeId)

// Update item
array.map(item => item.id === updateId ? { ...item, ...updates } : item)

// Find item
array.find(item => item.id === searchId)

// Check if exists
array.some(item => item.id === searchId)

// Get total
array.reduce((sum, item) => sum + item.value, 0)

// Sort
[...array].sort((a, b) => a.value - b.value)

// Group by
array.reduce((groups, item) => {
  const key = item.category;
  groups[key] = groups[key] || [];
  groups[key].push(item);
  return groups;
}, {})

// Flatten
array.flatMap(item => item.children)

// Unique by property
array.filter((item, index, self) => 
  self.findIndex(t => t.id === item.id) === index
)

// Chunk
Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
  array.slice(i * size, i * size + size)
)
```

---

## Performance Tips

### 1. Use Map for Frequent Lookups
```typescript
// ❌ Slow: O(n) for each lookup
const product = products.find(p => p.id === id);

// ✅ Fast: O(1) for each lookup
const productMap = new Map(products.map(p => [p.id, p]));
const product = productMap.get(id);
```

### 2. Avoid Nested Loops
```typescript
// ❌ Slow: O(n²)
const enriched = products.map(p => ({
  ...p,
  inventory: inventory.find(i => i.productId === p.id)
}));

// ✅ Fast: O(n)
const inventoryMap = new Map(inventory.map(i => [i.productId, i]));
const enriched = products.map(p => ({
  ...p,
  inventory: inventoryMap.get(p.id)
}));
```

### 3. Break Early When Possible
```typescript
// ❌ Checks all items
const hasExpensive = products.filter(p => p.price > 1000).length > 0;

// ✅ Stops at first match
const hasExpensive = products.some(p => p.price > 1000);
```

---

**Next**: Continue with [Part 2: Design Patterns →](./LEARNING-GUIDE-PART-2-PATTERNS.md)
