import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand,
  GetCommand
} from '@aws-sdk/lib-dynamodb';

/**
 * Idempotency Repository
 * 
 * Prevents duplicate event processing by tracking processed events.
 * Ensures at-least-once delivery doesn't cause duplicate side effects.
 */
export class IdempotencyRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Check if event has already been processed
   */
  async isProcessed(eventId: string): Promise<boolean> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { eventId }
    }));

    return !!result.Item;
  }

  /**
   * Mark event as processed (with conditional write to prevent race conditions)
   */
  async markProcessed(eventId: string, eventType: string, aggregateId: string): Promise<boolean> {
    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: {
          eventId,
          eventType,
          aggregateId,
          processedAt: new Date().toISOString(),
          // TTL: 7 days (enough to catch duplicates, then auto-cleanup)
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        },
        // Conditional write: only insert if doesn't exist
        ConditionExpression: 'attribute_not_exists(eventId)'
      }));

      console.log(`[Idempotency] Marked event ${eventId} as processed`);
      return true;

    } catch (error: any) {
      // ConditionalCheckFailedException means already processed
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`[Idempotency] Event ${eventId} already processed`);
        return false;
      }
      throw error;
    }
  }
}
