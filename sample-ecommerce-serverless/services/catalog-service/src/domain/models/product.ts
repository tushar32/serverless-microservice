import { AggregateRoot } from '@shared/domain-primitives';
import { Price } from './value-objects/price';
import { SKU } from './value-objects/sku';

export interface ProductProps {
  productId: string;
  name: string;
  description: string;
  price: Price;
  sku: SKU;
  category: string;
  inStock: boolean;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Product Aggregate Root (Catalog Bounded Context)
 * 
 * This is the Catalog context's view of a product.
 * Note: Orders context has a different view (ProductInfo)
 * via the Anti-Corruption Layer.
 */
export class Product extends AggregateRoot<ProductProps> {
  
  private constructor(props: ProductProps, id: string) {
    super(props, id);
  }

  static create(
    name: string,
    description: string,
    price: Price,
    sku: SKU,
    category: string,
    stockQuantity: number
  ): Product {
    if (!name || name.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    const productId = this.generateId();
    const now = new Date();

    const product = new Product(
      {
        productId,
        name: name.trim(),
        description: description?.trim() || '',
        price,
        sku,
        category,
        inStock: stockQuantity > 0,
        stockQuantity,
        createdAt: now,
        updatedAt: now
      },
      productId
    );

    return product;
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props, props.productId);
  }

  // Getters
  get productId(): string {
    return this.props.productId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get price(): Price {
    return this.props.price;
  }

  get sku(): SKU {
    return this.props.sku;
  }

  get category(): string {
    return this.props.category;
  }

  get inStock(): boolean {
    return this.props.inStock;
  }

  get stockQuantity(): number {
    return this.props.stockQuantity;
  }

  // Business logic
  updatePrice(newPrice: Price): void {
    if (newPrice.equals(this.price)) {
      return;
    }

    this.props.price = newPrice;
    this.props.updatedAt = new Date();

    // In a real system, you'd emit ProductPriceChangedEvent
  }

  updateStock(quantity: number): void {
    if (quantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    this.props.stockQuantity = quantity;
    this.props.inStock = quantity > 0;
    this.props.updatedAt = new Date();
  }

  reduceStock(amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (this.stockQuantity < amount) {
      throw new Error('Insufficient stock');
    }

    this.props.stockQuantity -= amount;
    this.props.inStock = this.stockQuantity > 0;
    this.props.updatedAt = new Date();
  }

  increaseStock(amount: number): void {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    this.props.stockQuantity += amount;
    this.props.inStock = true;
    this.props.updatedAt = new Date();
  }

  toJSON() {
    return {
      productId: this.productId,
      name: this.name,
      description: this.description,
      price: this.price.amount,
      currency: this.price.currency,
      sku: this.sku.value,
      category: this.category,
      inStock: this.inStock,
      stockQuantity: this.stockQuantity,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}
