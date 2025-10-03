import { Agent, interceptors } from 'undici';
import { RedisCacheStore, RedisCacheManager } from 'undici-cache-redis';
import { CircuitBreaker } from './circuit-breaker';

export interface UndiciRedisClientConfig {
  baseUrl: string;
  redisHost?: string;
  redisPort?: number;
  redisKeyPrefix?: string;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
  enableCache?: boolean;
  cacheTagsHeader?: string;
  maxEntrySize?: number;
}

/**
 * Enhanced HTTP Client with Redis-backed Caching
 * 
 * Features:
 * - Redis distributed cache (shared across all Lambda instances)
 * - Tag-based cache invalidation
 * - Client-side tracking cache for performance
 * - Circuit breaker for resilience
 * - Exponential backoff retry
 * 
 * Benefits over in-memory cache:
 * - ✅ Cache persists across Lambda cold starts
 * - ✅ All Lambda instances share the same cache
 * - ✅ Tag-based invalidation (e.g., invalidate all product:123 entries)
 * - ✅ Works with AWS ElastiCache
 * - ✅ Automatic cache synchronization across instances
 */
export class UndiciRedisClient {
  private agent: Agent;
  private cacheStore: RedisCacheStore;
  private cacheManager?: RedisCacheManager;
  private circuitBreaker: CircuitBreaker;
  private config: UndiciRedisClientConfig;

  constructor(config: UndiciRedisClientConfig) {
    this.config = {
      redisHost: process.env.REDIS_HOST || 'localhost',
      redisPort: parseInt(process.env.REDIS_PORT || '6379'),
      redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'http-cache:',
      timeout: 30000,
      retries: 3,
      circuitBreakerThreshold: 5,
      enableCache: true,
      cacheTagsHeader: 'cache-tags',
      maxEntrySize: 10 * 1024 * 1024, // 10MB max per entry
      ...config
    };

    // Initialize Redis cache store
    if (this.config.enableCache) {
      this.cacheStore = new RedisCacheStore({
        clientOpts: {
          host: this.config.redisHost,
          port: this.config.redisPort,
          keyPrefix: this.config.redisKeyPrefix,
          // For AWS ElastiCache, you might need:
          // tls: { rejectUnauthorized: false },
          // username: process.env.REDIS_USERNAME,
          // password: process.env.REDIS_PASSWORD
        },
        cacheTagsHeader: this.config.cacheTagsHeader,
        maxEntrySize: this.config.maxEntrySize,
        tracking: true, // Enable client-side tracking cache
        errorCallback: (err: Error) => {
          console.error('[UndiciRedisClient] Cache error:', err.message);
          // Don't throw - cache errors shouldn't break the app
        }
      });

      // Optional: Initialize cache manager for monitoring and invalidation
      if (process.env.ENABLE_CACHE_MANAGER === 'true') {
        this.cacheManager = new RedisCacheManager({
          clientOpts: {
            host: this.config.redisHost,
            port: this.config.redisPort
          },
          // For AWS ElastiCache, disable auto-configuration
          clientConfigKeyspaceEventNotify: process.env.IS_ELASTICACHE !== 'true'
        });

        this.setupCacheMonitoring();
      }
    }

    // Create Undici agent with caching interceptor
    this.agent = new Agent({
      connect: {
        timeout: this.config.timeout
      }
    });

    if (this.config.enableCache && this.cacheStore) {
      this.agent = this.agent.compose(
        interceptors.cache({
          store: this.cacheStore
        })
      );
    }

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      threshold: this.config.circuitBreakerThreshold!,
      timeout: 60000
    });
  }

  /**
   * Setup cache monitoring (optional)
   */
  private async setupCacheMonitoring(): Promise<void> {
    if (!this.cacheManager) return;

    try {
      await this.cacheManager.subscribe();

      this.cacheManager.on('add-entry', (entry) => {
        console.log('[Cache] Entry added:', {
          origin: entry.origin,
          path: entry.path,
          tags: entry.cacheTags
        });
      });

      this.cacheManager.on('delete-entry', ({ id, keyPrefix }) => {
        console.log('[Cache] Entry deleted:', { id, keyPrefix });
      });
    } catch (error) {
      console.error('[Cache] Error setting up monitoring:', error);
    }
  }

  /**
   * GET request with Redis-backed caching
   */
  async get<T>(path: string, options: any = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    if (!this.circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker is OPEN for ${this.config.baseUrl}`);
    }

    try {
      const response = await this.executeWithRetry(async () => {
        return await this.agent.request({
          origin: this.config.baseUrl,
          method: 'GET',
          path,
          ...options
        });
      });

      if (response.statusCode !== 200) {
        const errorText = await response.body.text();
        throw new Error(`HTTP ${response.statusCode}: ${errorText}`);
      }

      // Check if response came from cache
      const cacheStatus = response.headers['x-cache'];
      if (cacheStatus === 'HIT') {
        console.log(`[Cache] HIT: ${url}`);
      } else {
        console.log(`[Cache] MISS: ${url}`);
      }

      const data = await response.body.json();
      this.circuitBreaker.recordSuccess();
      return data as T;

    } catch (error) {
      this.circuitBreaker.recordFailure();
      console.error(`[HTTP Error] GET ${url}:`, error);
      throw error;
    }
  }

  /**
   * POST request (no caching)
   */
  async post<T>(path: string, body: any, options: any = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    if (!this.circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker is OPEN for ${this.config.baseUrl}`);
    }

    try {
      const response = await this.executeWithRetry(async () => {
        return await this.agent.request({
          origin: this.config.baseUrl,
          method: 'POST',
          path,
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const errorText = await response.body.text();
        throw new Error(`HTTP ${response.statusCode}: ${errorText}`);
      }

      const data = await response.body.json();
      this.circuitBreaker.recordSuccess();
      return data as T;

    } catch (error) {
      this.circuitBreaker.recordFailure();
      console.error(`[HTTP Error] POST ${url}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache by tags
   * 
   * Example: When product.updated event is received,
   * invalidate all cached responses tagged with 'product:123'
   */
  async invalidateCacheByTags(tags: string[]): Promise<void> {
    if (!this.cacheStore) {
      console.warn('[Cache] Cache store not initialized');
      return;
    }

    try {
      console.log(`[Cache] Invalidating tags:`, tags);
      await this.cacheStore.deleteTags(tags);
      console.log(`[Cache] Successfully invalidated ${tags.length} tag(s)`);
    } catch (error) {
      console.error('[Cache] Error invalidating tags:', error);
      // Don't throw - cache invalidation errors shouldn't break the app
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidateCacheByKey(origin: string, path: string, method: string = 'GET'): Promise<void> {
    if (!this.cacheStore) return;

    try {
      await this.cacheStore.deleteKeys([{ origin, path, method }]);
      console.log(`[Cache] Invalidated key: ${method} ${origin}${path}`);
    } catch (error) {
      console.error('[Cache] Error invalidating key:', error);
    }
  }

  /**
   * Get cache statistics (if manager is enabled)
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    entries: Array<{ origin: string; path: string; tags: string[] }>;
  }> {
    if (!this.cacheManager) {
      throw new Error('Cache manager is not enabled');
    }

    const entries: Array<{ origin: string; path: string; tags: string[] }> = [];

    await this.cacheManager.streamEntries((entry) => {
      entries.push({
        origin: entry.origin,
        path: entry.path,
        tags: entry.cacheTags
      });
    }, this.config.redisKeyPrefix!);

    return {
      totalEntries: entries.length,
      entries
    };
  }

  /**
   * Retry logic with exponential backoff
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.config.retries!) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Retry] Attempt ${attempt + 1}/${this.config.retries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Close connections (cleanup)
   */
  async close(): Promise<void> {
    if (this.cacheStore) {
      await this.cacheStore.close();
    }
    if (this.cacheManager) {
      // Close manager if needed
    }
    await this.agent.close();
  }
}
