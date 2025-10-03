import { Product } from '../models/product';

/**
 * Product Repository Interface (Domain Layer)
 */
export interface IProductRepository {
  save(product: Product): Promise<Product>;
  findById(productId: string): Promise<Product | null>;
  findByIds(productIds: string[]): Promise<Product[]>;
  findByCategory(category: string): Promise<Product[]>;
  findBySKU(sku: string): Promise<Product | null>;
  findInStock(): Promise<Product[]>;
  delete(productId: string): Promise<void>;
}
