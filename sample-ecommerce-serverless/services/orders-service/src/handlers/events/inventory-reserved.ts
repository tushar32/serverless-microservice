import { EventBridgeHandler } from 'aws-lambda';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';
import { SagaStateRepository, SagaStep } from '../../infrastructure/database/saga-state-repository';

const orderRepository = new DynamoDBOrderRepository(process.env.ORDERS_TABLE_NAME!);
const sagaRepository = new SagaStateRepository(process.env.SAGA_STATE_TABLE_NAME!);

/**
 * Success Handler: Inventory Reserved
 * 
 * When inventory is successfully reserved:
 * 1. Confirm the order
 * 2. Update saga state
 * 3. Order confirmed event triggers next steps (shipping, rewards, etc.)
 */
export const handler: EventBridgeHandler<'inventory.reserved', any, void> = async (event) => {
  console.log('[InventoryReserved] Received event:', JSON.stringify(event, null, 2));

  const { orderId } = event.detail;

  try {
    // Update saga state
    const sagaState = await sagaRepository.getSagaStateByOrderId(orderId);
    if (sagaState) {
      await sagaRepository.updateStep(
        sagaState.sagaId,
        SagaStep.INVENTORY_RESERVED,
        'SUCCESS'
      );
    }

    // Get order
    const order = await orderRepository.findById(orderId);
    
    if (!order) {
      console.error(`[InventoryReserved] Order ${orderId} not found`);
      return;
    }

    // Confirm the order
    console.log(`[InventoryReserved] Confirming order ${orderId}`);
    order.confirm();
    
    // Save order (this will publish OrderConfirmedEvent via outbox)
    await orderRepository.save(order);

    // Mark saga as completed
    if (sagaState) {
      await sagaRepository.markCompleted(sagaState.sagaId);
    }

    console.log(`[InventoryReserved] Successfully confirmed order ${orderId}`);

  } catch (error) {
    console.error('[InventoryReserved] Error:', error);
    throw error; // Let Lambda retry
  }
};
