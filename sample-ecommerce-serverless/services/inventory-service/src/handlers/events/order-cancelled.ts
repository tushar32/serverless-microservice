import { EventBridgeHandler } from 'aws-lambda';
import { IdempotencyRepository } from '../../infrastructure/database/idempotency-repository';

const idempotencyRepository = new IdempotencyRepository(process.env.IDEMPOTENCY_TABLE_NAME!);

/**
 * Inventory Service: Order Cancelled Handler
 * 
 * When an order is cancelled (compensation):
 * 1. Check idempotency
 * 2. Release reserved inventory (rollback)
 * 3. Make stock available again
 * 
 * This is the COMPENSATION/ROLLBACK step
 */
export const handler: EventBridgeHandler<'order.cancelled', any, void> = async (event) => {
  console.log('[Inventory-OrderCancelled] Received event:', JSON.stringify(event, null, 2));

  const eventId = event.id;
  const { orderId, reason } = event.detail;

  try {
    // Step 1: Check idempotency
    const alreadyProcessed = await idempotencyRepository.isProcessed(eventId);
    if (alreadyProcessed) {
      console.log(`[Inventory-OrderCancelled] Event ${eventId} already processed, skipping`);
      return;
    }

    // Step 2: Release inventory (compensation/rollback)
    console.log(`[Inventory-OrderCancelled] Releasing inventory for cancelled order ${orderId}`);
    console.log(`[Inventory-OrderCancelled] Cancellation reason: ${reason}`);

    await releaseInventory(orderId);

    // Step 3: Mark as processed
    await idempotencyRepository.markProcessed(eventId, 'order.cancelled', orderId);

    console.log(`[Inventory-OrderCancelled] Successfully released inventory for order ${orderId}`);

  } catch (error) {
    console.error('[Inventory-OrderCancelled] Error:', error);
    throw error; // Let Lambda retry
  }
};

/**
 * Release inventory (rollback reservation)
 * 
 * In a real implementation:
 * - Find reservation by orderId
 * - Add quantity back to available stock
 * - Delete reservation record
 */
async function releaseInventory(orderId: string): Promise<void> {
  // In real implementation:
  // const reservation = await inventoryRepository.getReservationByOrderId(orderId);
  // if (reservation) {
  //   for (const item of reservation.items) {
  //     await inventoryRepository.increaseStock(item.productId, item.quantity);
  //   }
  //   await inventoryRepository.deleteReservation(orderId);
  // }

  console.log(`[Inventory] Released inventory for order ${orderId}`);
}
