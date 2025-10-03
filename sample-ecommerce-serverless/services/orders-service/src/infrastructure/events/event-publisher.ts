import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DomainEvent } from '@shared/domain-primitives';

/**
 * Event Publisher
 * 
 * Publishes domain events to AWS EventBridge.
 * Other microservices subscribe to these events.
 */
export class EventPublisher {
  private client: EventBridgeClient;
  private eventBusName: string;

  constructor(eventBusName: string) {
    this.client = new EventBridgeClient({});
    this.eventBusName = eventBusName;
  }

  /**
   * Publish a domain event to EventBridge
   */
  async publish(event: DomainEvent): Promise<void> {
    try {
      const command = new PutEventsCommand({
        Entries: [
          {
            Source: 'orders-service',
            DetailType: event.eventType,
            Detail: JSON.stringify({
              ...event.eventData,
              occurredOn: event.occurredOn.toISOString(),
              aggregateId: event.aggregateId
            }),
            EventBusName: this.eventBusName
          }
        ]
      });

      const response = await this.client.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        console.error('[EventPublisher] Failed to publish event:', response.Entries);
        throw new Error(`Failed to publish event: ${event.eventType}`);
      }

      console.log('[EventPublisher] Event published successfully:', {
        eventType: event.eventType,
        aggregateId: event.aggregateId
      });
    } catch (error) {
      console.error('[EventPublisher] Error publishing event:', error);
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const entries = events.map(event => ({
        Source: 'orders-service',
        DetailType: event.eventType,
        Detail: JSON.stringify({
          ...event.eventData,
          occurredOn: event.occurredOn.toISOString(),
          aggregateId: event.aggregateId
        }),
        EventBusName: this.eventBusName
      }));

      // EventBridge supports up to 10 events per batch
      const batches = this.chunk(entries, 10);

      for (const batch of batches) {
        const command = new PutEventsCommand({ Entries: batch });
        await this.client.send(command);
      }

      console.log(`[EventPublisher] Published ${events.length} events successfully`);
    } catch (error) {
      console.error('[EventPublisher] Error publishing batch:', error);
      throw error;
    }
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
