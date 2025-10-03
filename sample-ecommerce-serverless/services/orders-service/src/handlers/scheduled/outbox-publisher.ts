import { ScheduledHandler } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { OutboxRepository } from '../../infrastructure/database/outbox-repository';

const eventBridgeClient = new EventBridgeClient({});
const outboxRepository = new OutboxRepository(
  process.env.OUTBOX_TABLE_NAME!,
  process.env.ORDERS_TABLE_NAME!
);

/**
 * Outbox Publisher Lambda
 * 
 * Runs every 30 seconds (or on schedule) to:
 * 1. Poll unpublished events from outbox
 * 2. Publish them to EventBridge
 * 3. Mark as published
 * 
 * This ensures reliable event delivery even if:
 * - Lambda crashes after saving order
 * - EventBridge is temporarily unavailable
 * - Network issues occur
 */
export const handler: ScheduledHandler = async (event) => {
  console.log('[OutboxPublisher] Starting outbox publishing...');

  try {
    // Get unpublished events
    const unpublishedEvents = await outboxRepository.getUnpublishedEvents(25);

    if (unpublishedEvents.length === 0) {
      console.log('[OutboxPublisher] No unpublished events found');
      return;
    }

    console.log(`[OutboxPublisher] Found ${unpublishedEvents.length} unpublished events`);

    // Process each event
    for (const outboxEvent of unpublishedEvents) {
      try {
        // Parse event data
        const eventData = JSON.parse(outboxEvent.eventData);

        // Publish to EventBridge
        await eventBridgeClient.send(new PutEventsCommand({
          Entries: [{
            Source: 'orders-service',
            DetailType: outboxEvent.eventType,
            Detail: JSON.stringify(eventData),
            EventBusName: process.env.EVENT_BUS_NAME || 'default'
          }]
        }));

        // Mark as published
        await outboxRepository.markPublished(outboxEvent.eventId);

        console.log(`[OutboxPublisher] Published event ${outboxEvent.eventId} (${outboxEvent.eventType})`);

      } catch (error) {
        console.error(`[OutboxPublisher] Failed to publish event ${outboxEvent.eventId}:`, error);
        
        // Increment retry count
        await outboxRepository.incrementRetryCount(outboxEvent.eventId);
        
        // Continue with next event (don't fail entire batch)
        continue;
      }
    }

    // Check for failed events (too many retries)
    const failedEvents = await outboxRepository.getFailedEvents();
    if (failedEvents.length > 0) {
      console.error(`[OutboxPublisher] WARNING: ${failedEvents.length} events failed after max retries!`);
      // You could send an alert here (SNS, CloudWatch Alarm, etc.)
    }

    console.log('[OutboxPublisher] Finished outbox publishing');

  } catch (error) {
    console.error('[OutboxPublisher] Fatal error:', error);
    throw error; // Let Lambda retry
  }
};
