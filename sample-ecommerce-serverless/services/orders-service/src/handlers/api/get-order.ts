import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';

const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME!;
const orderRepository = new DynamoDBOrderRepository(ORDERS_TABLE);

/**
 * Get Order by ID Handler
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  
  const orderId = event.pathParameters?.orderId;

  if (!orderId) {
    return errorResponse(400, 'Order ID is required');
  }

  console.log('[GetOrder] Fetching order:', { orderId });

  try {
    const order = await orderRepository.findById(orderId);

    if (!order) {
      return errorResponse(404, 'Order not found');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, max-age=60' // Cache for 1 minute
      },
      body: JSON.stringify(order.toJSON())
    };

  } catch (error: any) {
    console.error('[GetOrder] Error:', error);
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
