$root = $PSScriptRoot

# ============================================
# SHARED: HTTP Client with Undici + Caching
# ============================================

$httpClientContent = @"
import { request, Pool } from 'undici';
import { CacheManager } from './cache-manager';
import { CircuitBreaker } from './circuit-breaker';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  circuitBreakerThreshold?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

export class UndiciHttpClient {
  private pool: Pool;
  private cacheManager: CacheManager;
  private circuitBreaker: CircuitBreaker;
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      circuitBreakerThreshold: 5,
      enableCache: true,
      cacheTTL: 300,
      ...config
    };

    this.pool = new Pool(this.config.baseUrl, {
      connections: 10,
      pipelining: 1
    });

    this.cacheManager = new CacheManager({ ttl: this.config.cacheTTL!, maxSize: 100 });
    this.circuitBreaker = new CircuitBreaker({ threshold: this.config.circuitBreakerThreshold!, timeout: 60000 });
  }

  async get<T>(path: string, options: any = {}): Promise<T> {
    const url = `\${this.config.baseUrl}\${path}`;
    
    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cacheManager.get(url);
      if (cached) {
        console.log(`Cache HIT: \${url}`);
        return cached as T;
      }
    }

    if (!this.circuitBreaker.canExecute()) {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const response = await this.executeWithRetry(async () => {
        return await request(url, { method: 'GET', ...options, dispatcher: this.pool });
      });

      if (response.statusCode !== 200) {
        throw new Error(`HTTP \${response.statusCode}`);
      }

      const data = await response.body.json();
      
      if (this.config.enableCache) {
        this.cacheManager.set(url, data);
      }

      this.circuitBreaker.recordSuccess();
      return data as T;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, attempt: number = 0): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.config.retries!) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }
}
"@

Set-Content -Path "$root/shared/http-client/src/undici-client.ts" -Value $httpClientContent

# Cache Manager
$cacheManagerContent = @"
export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  etag?: string;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any, options?: { cacheControl?: string; etag?: string }): void {
    const ttl = this.parseCacheControl(options?.cacheControl) || this.config.ttl;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      etag: options?.etag
    });

    if (this.cache.size > this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  invalidateByPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private parseCacheControl(cacheControl?: string): number | null {
    if (!cacheControl) return null;
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}
"@

Set-Content -Path "$root/shared/http-client/src/cache-manager.ts" -Value $cacheManagerContent

# Circuit Breaker
$circuitBreakerContent = @"
export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
}

enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.config.timeout) {
        console.log('Circuit breaker: OPEN -> HALF_OPEN');
        this.state = CircuitBreakerState.HALF_OPEN;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      console.log('Circuit breaker: HALF_OPEN -> CLOSED');
      this.state = CircuitBreakerState.CLOSED;
    }
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.threshold) {
      console.log(`Circuit breaker: \${this.state} -> OPEN`);
      this.state = CircuitBreakerState.OPEN;
    }
  }
}
"@

Set-Content -Path "$root/shared/http-client/src/circuit-breaker.ts" -Value $circuitBreakerContent

Write-Host "HTTP Client files created!" -ForegroundColor Green
