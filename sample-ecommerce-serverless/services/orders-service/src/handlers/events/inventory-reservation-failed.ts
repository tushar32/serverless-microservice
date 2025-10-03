import { EventBridgeHandler } from 'aws-lambda';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';
import { EventBridgePublisher } from '../../infrastructure/events/event-publisher';
import { SagaStateRepository, SagaStep } from '../../infrastructure/database/saga-state-repository';

const orderRepository = new DynamoDBOrderRepository(process.env.ORDERS_TABLE_NAME!);
const eventPublisher = new EventBridgePublisher();
const sagaRepository = new SagaStateRepository(process.env.SAGA_STATE_TABLE_NAME!);

/**
 * Compensation Handler: Inventory Reservation Failed
 * 
 * When inventory service cannot reserve stock:
 * 1. Cancel the order (compensating transaction)
 * 2. Update saga state
 * 3. Notify customer (optional)
 * 
 * This is the COMPENSATION step of the saga
 */
export const handler: EventBridgeHandler<'inventory.reservation.failed', any, void> = async (event) => {
  console.log('[InventoryReservationFailed] Received event:', JSON.stringify(event, null, 2));

  const { orderId, reason } = event.detail;

  try {
    // Update saga state
    const sagaState = await sagaRepository.getSagaStateByOrderId(orderId);
    if (sagaState) {
      await sagaRepository.updateStep(
        sagaState.sagaId,
        SagaStep.INVENTORY_FAILED,
        'FAILED',
        reason
      );
      await sagaRepository.markForCompensation(
        sagaState.sagaId,
        reason,
        SagaStep.INVENTORY_FAILED
      );
    }

    // Get order
    const order = await orderRepository.findById(orderId);
    
    if (!order) {
      console.error(`[InventoryReservationFailed] Order ${orderId} not found`);
      return;
    }

    // Compensating transaction: Cancel the order
    console.log(`[InventoryReservationFailed] Cancelling order ${orderId}: ${reason}`);
    order.cancel(`Inventory reservation failed: ${reason}`);
    
    // Save order (this will publish OrderCancelledEvent via outbox)
    await orderRepository.save(order);

    // Mark saga as compensated
    if (sagaState) {
      await sagaRepository.markCompensated(sagaState.sagaId);
    }

    console.log(`[InventoryReservationFailed] Successfully compensated order ${orderId}`);

    // TODO: Send notification to customer
    // await notificationService.send(order.customerId, {
    //   subject: 'Order Cancelled',
    //   message: `Your order ${orderId} was cancelled: ${reason}`
    // });

  } catch (error) {
    console.error('[InventoryReservationFailed] Error:', error);
    throw error; // Let Lambda retry
  }
};
