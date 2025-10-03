import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ProductService } from '../../domain/services/product-service';
import { DynamoDBProductRepository } from '../../infrastructure/database/dynamodb-product-repository';

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME!;
const productRepository = new DynamoDBProductRepository(PRODUCTS_TABLE);
const productService = new ProductService(productRepository);

/**
 * Get Product Handler with HTTP Caching Headers
 * 
 * This handler demonstrates how to implement HTTP caching
 * that works with the Undici client in Orders service.
 * 
 * Caching Strategy:
 * - Cache-Control: max-age=300 (5 minutes)
 * - ETag: Hash of product data
 * - Last-Modified: Product update timestamp
 * - If-None-Match: 304 Not Modified response
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

    // Generate ETag (simple hash based on product data)
    const etag = generateETag(product);
    
    // Check If-None-Match header (client's cached ETag)
    const clientETag = event.headers['If-None-Match'] || event.headers['if-none-match'];
    
    if (clientETag === etag) {
      // Client has current version - return 304 Not Modified
      console.log('[GetProduct] Cache HIT (304):', { productId, etag });
      return {
        statusCode: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=300',
        },
        body: ''
      };
    }

    // Client doesn't have current version - return full response
    console.log('[GetProduct] Cache MISS (200):', { productId, etag });
    
    const productData = product.toJSON();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        
        // Caching headers for Undici client
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        // ↑ Cache for 5 minutes, serve stale for 1 minute while revalidating
        
        'ETag': etag,
        // ↑ Version identifier for conditional requests
        
        'Last-Modified': product.props.updatedAt.toUTCString(),
        // ↑ When product was last updated
        
        'Vary': 'Accept-Encoding',
        // ↑ Cache varies by encoding
      },
      body: JSON.stringify(productData)
    };

  } catch (error: any) {
    console.error('[GetProduct] Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * Generate ETag (simple implementation)
 * In production, use a proper hash function
 */
function generateETag(product: any): string {
  const data = JSON.stringify({
    id: product.productId,
    price: product.price.amount,
    stock: product.stockQuantity,
    updated: product.props.updatedAt.getTime()
  });
  
  // Simple hash (use crypto in production)
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
