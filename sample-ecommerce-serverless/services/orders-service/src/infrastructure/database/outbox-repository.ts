import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand,
  QueryCommand,
  UpdateCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { Order } from '../../domain/models/order';
import { BaseDomainEvent } from '@shared/domain-primitives';

export interface OutboxEvent {
  eventId: string;
  aggregateId: string;
  eventType: string;
  eventData: string;
  published: boolean;
  createdAt: string;
  publishedAt?: string;
  retryCount: number;
}

/**
 * Outbox Pattern Implementation
 * 
 * Ensures reliable event publishing by:
 * 1. Saving events atomically with aggregate
 * 2. Publishing events asynchronously via polling
 * 3. Guaranteeing at-least-once delivery
 */
export class OutboxRepository {
  private docClient: DynamoDBDocumentClient;
  private outboxTableName: string;
  private ordersTableName: string;

  constructor(outboxTableName: string, ordersTableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.outboxTableName = outboxTableName;
    this.ordersTableName = ordersTableName;
  }

  /**
   * Save order and events atomically in a single transaction
   * This ensures ACID properties within the Orders service
   */
  async saveOrderWithEvents(order: Order, orderItem: any): Promise<void> {
    const events = order.domainEvents;
    
    if (events.length === 0) {
      // No events, just save the order
      await this.docClient.send(new PutCommand({
        TableName: this.ordersTableName,
        Item: orderItem
      }));
      return;
    }

    // Build transaction items
    const transactItems: any[] = [
      // 1. Save order
      {
        Put: {
          TableName: this.ordersTableName,
          Item: orderItem
        }
      }
    ];

    // 2. Save all events to outbox
    for (const event of events) {
      transactItems.push({
        Put: {
          TableName: this.outboxTableName,
          Item: {
            eventId: this.generateEventId(),
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            eventData: JSON.stringify(event.data),
            published: false,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            // Add TTL (30 days after creation)
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
          }
        }
      });
    }

    // Execute transaction (atomic!)
    await this.docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    console.log(`[Outbox] Saved order ${order.id} with ${events.length} events atomically`);
  }

  /**
   * Get unpublished events (for polling)
   */
  async getUnpublishedEvents(limit: number = 25): Promise<OutboxEvent[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.outboxTableName,
      IndexName: 'PublishedIndex',
      KeyConditionExpression: 'published = :published',
      ExpressionAttributeValues: {
        ':published': false
      },
      Limit: limit,
      // Only get events that haven't been retried too many times
      FilterExpression: 'retryCount < :maxRetries',
      ExpressionAttributeNames: {
        '#retryCount': 'retryCount'
      },
      ExpressionAttributeValues: {
        ':published': false,
        ':maxRetries': 5
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items as OutboxEvent[];
  }

  /**
   * Mark event as published
   */
  async markPublished(eventId: string): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.outboxTableName,
      Key: { eventId },
      UpdateExpression: 'SET published = :published, publishedAt = :publishedAt',
      ExpressionAttributeValues: {
        ':published': true,
        ':publishedAt': new Date().toISOString()
      }
    }));

    console.log(`[Outbox] Marked event ${eventId} as published`);
  }

  /**
   * Increment retry count on failure
   */
  async incrementRetryCount(eventId: string): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.outboxTableName,
      Key: { eventId },
      UpdateExpression: 'SET retryCount = retryCount + :inc',
      ExpressionAttributeValues: {
        ':inc': 1
      }
    }));
  }

  /**
   * Get events that failed too many times (for manual intervention)
   */
  async getFailedEvents(): Promise<OutboxEvent[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.outboxTableName,
      IndexName: 'PublishedIndex',
      KeyConditionExpression: 'published = :published',
      FilterExpression: 'retryCount >= :maxRetries',
      ExpressionAttributeValues: {
        ':published': false,
        ':maxRetries': 5
      }
    }));

    return (result.Items || []) as OutboxEvent[];
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
