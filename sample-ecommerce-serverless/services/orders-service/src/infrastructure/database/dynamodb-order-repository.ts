import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand,
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { Order } from '../../domain/models/order';
import { OrderItem } from '../../domain/models/order-item';
import { Money } from '../../domain/models/value-objects/money';
import { OrderStatus, OrderStatusType } from '../../domain/models/value-objects/order-status';
import { IOrderRepository } from '../../domain/repositories/order-repository';

/**
 * DynamoDB implementation of Order Repository
 * 
 * This translates between domain models and database schema
 */
export class DynamoDBOrderRepository implements IOrderRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  async save(order: Order): Promise<Order> {
    const item = this.toDatabase(order);

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));

    return order;
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { orderId }
    }));

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'CustomerIdIndex',
      KeyConditionExpression: 'customerId = :customerId',
      ExpressionAttributeValues: {
        ':customerId': customerId
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map(item => this.toDomain(item));
  }

  async findByStatus(status: string): Promise<Order[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StatusIndex',
      KeyConditionExpression: 'orderStatus = :status',
      ExpressionAttributeValues: {
        ':status': status
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map(item => this.toDomain(item));
  }

  async delete(orderId: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { orderId }
    }));
  }

  async exists(orderId: string): Promise<boolean> {
    const order = await this.findById(orderId);
    return order !== null;
  }

  /**
   * Map domain model to database schema
   */
  private toDatabase(order: Order): any {
    return {
      orderId: order.orderId,
      customerId: order.customerId,
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        currency: item.unitPrice.currency,
        lineTotal: item.lineTotal.amount
      })),
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      orderStatus: order.status.value,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    };
  }

  /**
   * Map database schema to domain model
   */
  private toDomain(item: any): Order {
    const items = item.items.map((dbItem: any) =>
      OrderItem.create(
        dbItem.productId,
        dbItem.productName,
        dbItem.quantity,
        Money.create(dbItem.unitPrice, dbItem.currency)
      )
    );

    return Order.reconstitute({
      orderId: item.orderId,
      customerId: item.customerId,
      items,
      totalAmount: Money.create(item.totalAmount, item.currency),
      status: OrderStatus.create(item.orderStatus as OrderStatusType),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    });
  }
}
