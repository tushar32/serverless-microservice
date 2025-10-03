import { Product } from '../models/product';
import { IProductRepository } from '../repositories/product-repository';

/**
 * Product Domain Service
 * 
 * Contains business logic that doesn't naturally fit in a single aggregate.
 * In this case, it's a thin wrapper around the repository, but could include:
 * - Complex product search logic
 * - Pricing calculations involving multiple products
 * - Inventory management across products
 */
export class ProductService {
  constructor(private productRepository: IProductRepository) {}

  async getById(productId: string): Promise<Product | null> {
    return await this.productRepository.findById(productId);
  }

  async getByIds(productIds: string[]): Promise<Map<string, Product>> {
    const products = await this.productRepository.findByIds(productIds);
    
    const productMap = new Map<string, Product>();
    products.forEach(product => {
      productMap.set(product.productId, product);
    });
    
    return productMap;
  }

  async getByCategory(category: string): Promise<Product[]> {
    return await this.productRepository.findByCategory(category);
  }

  async getInStock(): Promise<Product[]> {
    return await this.productRepository.findInStock();
  }

  async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    const product = await this.productRepository.findById(productId);
    
    if (!product) {
      return false;
    }

    return product.inStock && product.stockQuantity >= quantity;
  }
}
