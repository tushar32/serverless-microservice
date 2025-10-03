import { EventBridgeHandler } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { IdempotencyRepository } from '../../infrastructure/database/idempotency-repository';

const eventBridgeClient = new EventBridgeClient({});
const idempotencyRepository = new IdempotencyRepository(process.env.IDEMPOTENCY_TABLE_NAME!);

interface OrderItem {
  productId: string;
  quantity: number;
}

/**
 * Inventory Service: Order Created Handler
 * 
 * When an order is created:
 * 1. Check idempotency (prevent duplicate processing)
 * 2. Try to reserve inventory
 * 3. Publish success or failure event
 * 
 * This is the FIRST STEP of the distributed transaction saga
 */
export const handler: EventBridgeHandler<'order.created', any, void> = async (event) => {
  console.log('[Inventory-OrderCreated] Received event:', JSON.stringify(event, null, 2));

  const eventId = event.id; // EventBridge event ID
  const { orderId, items } = event.detail;

  try {
    // Step 1: Check idempotency
    const alreadyProcessed = await idempotencyRepository.isProcessed(eventId);
    if (alreadyProcessed) {
      console.log(`[Inventory-OrderCreated] Event ${eventId} already processed, skipping`);
      return; // Idempotent! Exit gracefully
    }

    // Step 2: Try to reserve inventory
    console.log(`[Inventory-OrderCreated] Reserving inventory for order ${orderId}`);
    
    try {
      await reserveInventory(items);
      
      // Step 3a: Success! Publish inventory.reserved event
      await eventBridgeClient.send(new PutEventsCommand({
        Entries: [{
          Source: 'inventory-service',
          DetailType: 'inventory.reserved',
          Detail: JSON.stringify({
            orderId,
            items,
            reservedAt: new Date().toISOString()
          }),
          EventBusName: process.env.EVENT_BUS_NAME || 'default'
        }]
      }));

      console.log(`[Inventory-OrderCreated] Successfully reserved inventory for order ${orderId}`);

    } catch (reservationError: any) {
      // Step 3b: Failed! Publish inventory.reservation.failed event
      console.error(`[Inventory-OrderCreated] Failed to reserve inventory:`, reservationError);
      
      await eventBridgeClient.send(new PutEventsCommand({
        Entries: [{
          Source: 'inventory-service',
          DetailType: 'inventory.reservation.failed',
          Detail: JSON.stringify({
            orderId,
            reason: reservationError.message || 'Insufficient stock',
            failedAt: new Date().toISOString()
          }),
          EventBusName: process.env.EVENT_BUS_NAME || 'default'
        }]
      }));
    }

    // Step 4: Mark as processed (idempotency)
    await idempotencyRepository.markProcessed(eventId, 'order.created', orderId);

  } catch (error) {
    console.error('[Inventory-OrderCreated] Fatal error:', error);
    throw error; // Let Lambda retry
  }
};

/**
 * Reserve inventory for order items
 * 
 * In a real implementation, this would:
 * - Check stock levels in DynamoDB
 * - Reduce available quantity
 * - Create reservation record
 * 
 * For this example, we simulate the logic
 */
async function reserveInventory(items: OrderItem[]): Promise<void> {
  // Simulate inventory check
  for (const item of items) {
    // In real implementation:
    // const product = await inventoryRepository.getProduct(item.productId);
    // if (product.availableQuantity < item.quantity) {
    //   throw new Error(`Insufficient stock for product ${item.productId}`);
    // }
    // await inventoryRepository.reduceStock(item.productId, item.quantity);

    console.log(`[Inventory] Reserving ${item.quantity} units of product ${item.productId}`);
    
    // Simulate 5% failure rate (out of stock)
    if (Math.random() < 0.05) {
      throw new Error(`Insufficient stock for product ${item.productId}`);
    }
  }

  // All items reserved successfully
  console.log(`[Inventory] All items reserved successfully`);
}
