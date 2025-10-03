import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand,
  BatchGetCommand,
  QueryCommand,
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { Product } from '../../domain/models/product';
import { Price } from '../../domain/models/value-objects/price';
import { SKU } from '../../domain/models/value-objects/sku';
import { IProductRepository } from '../../domain/repositories/product-repository';

/**
 * DynamoDB implementation of Product Repository
 */
export class DynamoDBProductRepository implements IProductRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  async save(product: Product): Promise<Product> {
    const item = this.toDatabase(product);

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));

    return product;
  }

  async findById(productId: string): Promise<Product | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { productId }
    }));

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item);
  }

  async findByIds(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) {
      return [];
    }

    // BatchGet supports up to 100 items
    const chunks = this.chunk(productIds, 100);
    const products: Product[] = [];

    for (const chunk of chunks) {
      const result = await this.docClient.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: chunk.map(id => ({ productId: id }))
          }
        }
      }));

      const items = result.Responses?.[this.tableName] || [];
      products.push(...items.map(item => this.toDomain(item)));
    }

    return products;
  }

  async findByCategory(category: string): Promise<Product[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'CategoryIndex',
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: {
        ':category': category
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map(item => this.toDomain(item));
  }

  async findBySKU(sku: string): Promise<Product | null> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'SKUIndex',
      KeyConditionExpression: 'sku = :sku',
      ExpressionAttributeValues: {
        ':sku': sku
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.toDomain(result.Items[0]);
  }

  async findInStock(): Promise<Product[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StockIndex',
      KeyConditionExpression: 'inStock = :inStock',
      ExpressionAttributeValues: {
        ':inStock': true
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map(item => this.toDomain(item));
  }

  async delete(productId: string): Promise<void> {
    await this.docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { productId }
    }));
  }

  /**
   * Map domain model to database schema
   */
  private toDatabase(product: Product): any {
    return {
      productId: product.productId,
      name: product.name,
      description: product.description,
      price: product.price.amount,
      currency: product.price.currency,
      sku: product.sku.value,
      category: product.category,
      inStock: product.inStock,
      stockQuantity: product.stockQuantity,
      createdAt: product.props.createdAt.toISOString(),
      updatedAt: product.props.updatedAt.toISOString()
    };
  }

  /**
   * Map database schema to domain model
   */
  private toDomain(item: any): Product {
    return Product.reconstitute({
      productId: item.productId,
      name: item.name,
      description: item.description || '',
      price: Price.create(item.price, item.currency),
      sku: SKU.create(item.sku),
      category: item.category,
      inStock: item.inStock,
      stockQuantity: item.stockQuantity,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    });
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
