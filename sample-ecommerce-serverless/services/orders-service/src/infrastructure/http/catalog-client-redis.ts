import { UndiciRedisClient } from '@shared/http-client/src';

/**
 * Catalog Service Response (from external service)
 */
interface CatalogProductResponse {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  inStock: boolean;
}

/**
 * Internal domain model (what Orders context understands)
 */
export interface ProductInfo {
  productId: string;
  name: string;
  price: number;
  currency: string;
  available: boolean;
}

/**
 * Catalog Client with Redis-Backed Caching - Anti-Corruption Layer (ACL)
 * 
 * UPGRADED VERSION using undici-cache-redis
 * 
 * Improvements over in-memory cache:
 * ✅ Redis distributed cache (shared across all Lambda instances)
 * ✅ Cache persists across Lambda cold starts
 * ✅ Tag-based invalidation (product:123, category:electronics)
 * ✅ AWS ElastiCache support
 * ✅ Automatic cache synchronization
 * ✅ Client-side tracking cache for ultra-fast lookups
 * 
 * Benefits:
 * - First Lambda: Cache MISS → fetch from Catalog → store in Redis
 * - All subsequent Lambdas: Cache HIT → < 1ms response from Redis
 * - Product updates → Event triggers cache invalidation → All Lambdas get fresh data
 * 
 * Example Flow:
 * 1. Orders Lambda 1: GET /products/123 → Cache MISS → HTTP call → Store in Redis
 * 2. Orders Lambda 2: GET /products/123 → Cache HIT from Redis (< 1ms)
 * 3. Orders Lambda 3: GET /products/123 → Cache HIT from Redis (< 1ms)
 * 4. Catalog publishes product.updated event
 * 5. Cache invalidation Lambda: Invalidate tag 'product:123'
 * 6. Orders Lambda 4: GET /products/123 → Cache MISS → Fresh data
 */
export class CatalogClientRedis {
  private httpClient: UndiciRedisClient;

  constructor(catalogServiceUrl: string) {
    this.httpClient = new UndiciRedisClient({
      baseUrl: catalogServiceUrl,
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
      redisKeyPrefix: 'catalog-cache:',
      timeout: 5000,
      retries: 3,
      enableCache: true,
      cacheTagsHeader: 'cache-tags', // Match Catalog service header
      maxEntrySize: 5 * 1024 * 1024 // 5MB max per product
    });
  }

  /**
   * Get product details by ID
   * 
   * With Redis cache:
   * - First call: ~200ms (HTTP + DynamoDB)
   * - Cached calls: < 1ms (Redis lookup)
   * - All Lambda instances share the same cache!
   */
  async getProduct(productId: string): Promise<ProductInfo | null> {
    try {
      const response = await this.httpClient.get<CatalogProductResponse>(
        `/products/${productId}`
      );

      // Translate from Catalog's model to Orders' model (ACL)
      return this.translateToOrdersDomain(response);
    } catch (error) {
      console.error(`[CatalogClientRedis] Error fetching product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple products in one call
   * 
   * Note: This makes a single HTTP request but the response is cached.
   * Individual product lookups will hit the cache on subsequent calls.
   */
  async getProducts(productIds: string[]): Promise<Map<string, ProductInfo>> {
    try {
      const response = await this.httpClient.get<CatalogProductResponse[]>(
        `/products?ids=${productIds.join(',')}`
      );

      const productMap = new Map<string, ProductInfo>();
      
      response.forEach(catalogProduct => {
        const orderProduct = this.translateToOrdersDomain(catalogProduct);
        if (orderProduct) {
          productMap.set(orderProduct.productId, orderProduct);
        }
      });

      return productMap;
    } catch (error) {
      console.error('[CatalogClientRedis] Error fetching multiple products:', error);
      return new Map();
    }
  }

  /**
   * Check product availability
   */
  async checkAvailability(productId: string, quantity: number): Promise<boolean> {
    try {
      const product = await this.getProduct(productId);
      
      if (!product) {
        return false;
      }

      return product.available;
    } catch (error) {
      console.error(`[CatalogClientRedis] Error checking availability for ${productId}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache when product changes
   * 
   * This is typically called by an event handler when product.updated event is received.
   * You can also call it manually when needed.
   * 
   * Example usage:
   * ```typescript
   * // When product.updated event received
   * await catalogClient.invalidateProduct('product-123');
   * 
   * // This invalidates cache for:
   * // - GET /products/product-123
   * // - Any other cached responses tagged with 'product:product-123'
   * ```
   */
  async invalidateProduct(productId: string): Promise<void> {
    console.log(`[CatalogClientRedis] Invalidating cache for product ${productId}`);
    
    // Invalidate by tag (this invalidates ALL cached responses with this tag)
    await this.httpClient.invalidateCacheByTags([`product:${productId}`]);
  }

  /**
   * Invalidate cache for a category
   * 
   * Useful when you want to refresh all products in a category.
   */
  async invalidateCategory(category: string): Promise<void> {
    console.log(`[CatalogClientRedis] Invalidating cache for category ${category}`);
    await this.httpClient.invalidateCacheByTags([`category:${category}`]);
  }

  /**
   * ACL Translation Method
   * 
   * Translates Catalog's data model to Orders' domain model.
   * This protects Orders from changes in Catalog's API.
   */
  private translateToOrdersDomain(
    catalogProduct: CatalogProductResponse
  ): ProductInfo {
    return {
      productId: catalogProduct.productId,
      name: catalogProduct.name,
      price: catalogProduct.price,
      currency: catalogProduct.currency,
      available: catalogProduct.inStock
    };
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getHealthStatus(): string {
    return this.httpClient.getCircuitBreakerState();
  }

  /**
   * Get cache statistics (requires cache manager to be enabled)
   */
  async getCacheStats() {
    try {
      return await this.httpClient.getCacheStats();
    } catch (error) {
      console.warn('[CatalogClientRedis] Cache stats not available:', error);
      return { totalEntries: 0, entries: [] };
    }
  }

  /**
   * Close connections (cleanup)
   */
  async close(): Promise<void> {
    await this.httpClient.close();
  }
}
