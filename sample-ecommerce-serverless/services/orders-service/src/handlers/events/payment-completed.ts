import { EventBridgeHandler } from 'aws-lambda';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';
import { EventPublisher } from '../../infrastructure/events/event-publisher';

/**
 * Payment Completed Event Handler
 * 
 * This Lambda is triggered by EventBridge when a payment is completed.
 * It updates the order status and publishes an order.completed event.
 * 
 * This demonstrates event-driven communication between microservices.
 */

const ORDERS_TABLE = process.env.ORDERS_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

const orderRepository = new DynamoDBOrderRepository(ORDERS_TABLE);
const eventPublisher = new EventPublisher(EVENT_BUS_NAME);

interface PaymentCompletedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  completedAt: string;
}

export const handler: EventBridgeHandler<
  'payment.completed',
  PaymentCompletedEvent,
  void
> = async (event) => {
  console.log('[PaymentCompletedHandler] Received event:', event);

  try {
    const paymentEvent = event.detail;

    // Step 1: Get the order
    const order = await orderRepository.findById(paymentEvent.orderId);

    if (!order) {
      console.error(`[PaymentCompletedHandler] Order not found: ${paymentEvent.orderId}`);
      return;
    }

    // Step 2: Complete the order (domain logic)
    order.complete();

    // Step 3: Save the updated order
    await orderRepository.save(order);

    console.log('[PaymentCompletedHandler] Order completed:', {
      orderId: order.orderId,
      status: order.status.toString()
    });

    // Step 4: Publish domain events
    for (const domainEvent of order.domainEvents) {
      await eventPublisher.publish(domainEvent);
    }

    order.clearEvents();

  } catch (error) {
    console.error('[PaymentCompletedHandler] Error:', error);
    // In production, you might want to send to DLQ or retry
    throw error;
  }
};
