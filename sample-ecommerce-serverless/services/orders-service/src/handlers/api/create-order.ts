import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';
import { CatalogClient } from '../../infrastructure/http/catalog-client';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { CreateOrderDTO } from '../../application/dto/create-order.dto';

/**
 * Lambda Handler for Create Order API
 * 
 * This is the entry point for the Lambda function.
 * It sets up dependencies and delegates to the use case.
 * 
 * Pattern: Composition Root / Dependency Injection
 */

// Environment variables
const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME!;
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

// Initialize dependencies (can be cached between invocations)
const orderRepository = new DynamoDBOrderRepository(ORDERS_TABLE);
const catalogClient = new CatalogClient(CATALOG_SERVICE_URL);
const eventPublisher = new EventPublisher(EVENT_BUS_NAME);

// Create use case
const createOrderUseCase = new CreateOrderUseCase(
  orderRepository,
  catalogClient,
  eventPublisher
);

/**
 * Handler function
 */
export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[CreateOrderHandler] Received request:', {
    path: event.path,
    method: event.httpMethod,
    requestId: event.requestContext.requestId
  });

  try {
    // Parse request body
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    const dto: CreateOrderDTO = JSON.parse(event.body);

    // Execute use case
    const result = await createOrderUseCase.execute(dto);

    // Return success response
    return successResponse(201, result);

  } catch (error: any) {
    console.error('[CreateOrderHandler] Error:', error);

    // Handle specific error types
    if (error.message.includes('not found')) {
      return errorResponse(404, error.message);
    }

    if (error.message.includes('not available')) {
      return errorResponse(409, error.message);
    }

    if (error.message.includes('required') || error.message.includes('must')) {
      return errorResponse(400, error.message);
    }

    // Generic error
    return errorResponse(500, 'Internal server error');
  }
};

/**
 * Build success response
 */
function successResponse(statusCode: number, data: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  };
}

/**
 * Build error response
 */
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
