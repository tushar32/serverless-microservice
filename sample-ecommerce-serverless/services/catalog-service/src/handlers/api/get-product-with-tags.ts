import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProductService } from '../../domain/services/product-service';
import { DynamoDBProductRepository } from '../../infrastructure/database/dynamodb-product-repository';

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME!;
const productRepository = new DynamoDBProductRepository(PRODUCTS_TABLE);
const productService = new ProductService(productRepository);

/**
 * Get Product Handler with Cache-Tags Support
 * 
 * This handler is optimized for undici-cache-redis by adding Cache-Tags header.
 * The Orders service can then invalidate cached responses by tags when products change.
 * 
 * Example Cache Tags:
 * - product:123 (specific product)
 * - category:electronics (all products in category)
 * - sku:MOUSE-001 (specific SKU)
 * 
 * When a product is updated, we invalidate: ['product:123', 'category:electronics']
 * This automatically invalidates all cached responses for this product!
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  
  const productId = event.pathParameters?.productId;

  if (!productId) {
    return errorResponse(400, 'Product ID is required');
  }

  try {
    const product = await productService.getById(productId);

    if (!product) {
      return errorResponse(404, 'Product not found');
    }

    // Generate ETag
    const etag = generateETag(product);
    
    // Check If-None-Match header
    const clientETag = event.headers['If-None-Match'] || event.headers['if-none-match'];
    
    if (clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=300',
        },
        body: ''
      };
    }

    const productData = product.toJSON();

    // Generate cache tags for this product
    const cacheTags = [
      `product:${product.productId}`,       // Specific product
      `category:${product.category}`,       // All products in this category
      `sku:${product.sku.value}`,          // Specific SKU
      product.inStock ? 'in-stock' : 'out-of-stock'  // Stock status
    ];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        
        // HTTP Caching headers
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'ETag': etag,
        'Last-Modified': product.props.updatedAt.toUTCString(),
        'Vary': 'Accept-Encoding',
        
        // Cache tags for undici-cache-redis
        'Cache-Tags': cacheTags.join(','),
        // ↑ This enables tag-based invalidation!
        // When product updates, we invalidate all these tags
      },
      body: JSON.stringify(productData)
    };

  } catch (error: any) {
    console.error('[GetProduct] Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * Generate ETag
 */
function generateETag(product: any): string {
  const data = JSON.stringify({
    id: product.productId,
    price: product.price.amount,
    stock: product.stockQuantity,
    updated: product.props.updatedAt.getTime()
  });
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  
  return `"${Math.abs(hash).toString(36)}"`;
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      error: message,
      timestamp: new Date().toISOString()
    })
  };
}
