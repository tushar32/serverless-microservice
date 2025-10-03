import { EventBridgeHandler } from 'aws-lambda';
import { UndiciRedisClient } from '@shared/http-client';

/**
 * Product Updated Event Handler
 * 
 * This Lambda is triggered when Catalog service publishes product.updated event.
 * It invalidates cached product data in Orders service using Redis cache tags.
 * 
 * Flow:
 * 1. Catalog publishes: product.updated event
 * 2. EventBridge routes to this Lambda
 * 3. Lambda invalidates Redis cache by tags
 * 4. Next Orders service request gets fresh product data
 * 
 * This ensures Orders service always has up-to-date product information!
 */

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL!;

// Initialize client (reuse across warm invocations)
const catalogClient = new UndiciRedisClient({
  baseUrl: CATALOG_SERVICE_URL,
  enableCache: true
});

interface ProductUpdatedEvent {
  productId: string;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

export const handler: EventBridgeHandler<
  'product.updated',
  ProductUpdatedEvent,
  void
> = async (event) => {
  console.log('[ProductUpdatedHandler] Received event:', JSON.stringify(event, null, 2));

  try {
    const productEvent = event.detail;
    const productId = productEvent.productId;

    // Determine which cache tags to invalidate based on what changed
    const tagsToInvalidate: string[] = [
      `product:${productId}` // Always invalidate the specific product
    ];

    // Check if category changed
    const categoryChange = productEvent.changes.find(c => c.field === 'category');
    if (categoryChange) {
      // Invalidate both old and new category caches
      tagsToInvalidate.push(`category:${categoryChange.oldValue}`);
      tagsToInvalidate.push(`category:${categoryChange.newValue}`);
    }

    // Check if stock status changed
    const stockChange = productEvent.changes.find(c => c.field === 'inStock');
    if (stockChange) {
      tagsToInvalidate.push('in-stock', 'out-of-stock');
    }

    console.log('[ProductUpdatedHandler] Invalidating cache tags:', tagsToInvalidate);

    // Invalidate cache by tags
    // This will remove ALL cached responses that have these tags
    await catalogClient.invalidateCacheByTags(tagsToInvalidate);

    console.log('[ProductUpdatedHandler] Cache invalidation complete');

    // Optional: Log cache statistics
    if (process.env.LOG_CACHE_STATS === 'true') {
      try {
        const stats = await catalogClient.getCacheStats();
        console.log('[ProductUpdatedHandler] Cache stats:', {
          totalEntries: stats.totalEntries,
          remainingEntries: stats.entries.length
        });
      } catch (error) {
        console.warn('[ProductUpdatedHandler] Could not fetch cache stats:', error);
      }
    }

  } catch (error) {
    console.error('[ProductUpdatedHandler] Error:', error);
    // Don't throw - cache invalidation errors shouldn't fail the entire flow
    // The cache will eventually expire based on TTL
  }
};
