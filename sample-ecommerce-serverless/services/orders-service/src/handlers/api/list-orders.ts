import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';

const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME!;
const orderRepository = new DynamoDBOrderRepository(ORDERS_TABLE);

/**
 * List Orders Handler
 * 
 * Query parameters:
 * - customerId (required): Filter by customer
 * - status (optional): Filter by order status
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  
  const customerId = event.queryStringParameters?.customerId;
  const status = event.queryStringParameters?.status;

  if (!customerId) {
    return errorResponse(400, 'customerId query parameter is required');
  }

  console.log('[ListOrders] Fetching orders:', { customerId, status });

  try {
    let orders = await orderRepository.findByCustomerId(customerId);

    // Optional: Filter by status
    if (status) {
      orders = orders.filter(order => order.status.toString() === status.toUpperCase());
    }

    // Sort by creation date (newest first)
    orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const response = {
      total: orders.length,
      orders: orders.map(order => order.toJSON())
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, max-age=30' // Cache for 30 seconds
      },
      body: JSON.stringify(response)
    };

  } catch (error: any) {
    console.error('[ListOrders] Error:', error);
    return errorResponse(500, 'Internal server error');
  }
};

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
