import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';

export enum SagaStep {
  CREATED = 'CREATED',
  INVENTORY_RESERVING = 'INVENTORY_RESERVING',
  INVENTORY_RESERVED = 'INVENTORY_RESERVED',
  INVENTORY_FAILED = 'INVENTORY_FAILED',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CONFIRMED = 'CONFIRMED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED'
}

export interface SagaStepDetails {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  timestamp: string;
  error?: string;
}

export interface SagaState {
  sagaId: string;
  orderId: string;
  currentStep: SagaStep;
  steps: {
    created: SagaStepDetails;
    inventoryReservation?: SagaStepDetails;
    paymentProcessing?: SagaStepDetails;
    confirmation?: SagaStepDetails;
    compensation?: SagaStepDetails;
  };
  compensationRequired: boolean;
  compensationReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Saga State Repository
 * 
 * Tracks the state of distributed transactions (sagas)
 * Useful for:
 * - Monitoring saga progress
 * - Debugging failed transactions
 * - Manual intervention
 * - Compliance/audit trails
 */
export class SagaStateRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string) {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Create new saga state
   */
  async createSagaState(orderId: string): Promise<SagaState> {
    const sagaId = this.generateSagaId();
    const now = new Date().toISOString();

    const sagaState: SagaState = {
      sagaId,
      orderId,
      currentStep: SagaStep.CREATED,
      steps: {
        created: {
          status: 'SUCCESS',
          timestamp: now
        }
      },
      compensationRequired: false,
      createdAt: now,
      updatedAt: now
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: sagaState
    }));

    console.log(`[Saga] Created saga state ${sagaId} for order ${orderId}`);
    return sagaState;
  }

  /**
   * Update saga step
   */
  async updateStep(
    sagaId: string,
    step: SagaStep,
    status: 'PENDING' | 'SUCCESS' | 'FAILED',
    error?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const stepKey = this.getStepKey(step);

    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { sagaId },
      UpdateExpression: `SET currentStep = :currentStep, steps.#stepKey = :stepData, updatedAt = :updatedAt`,
      ExpressionAttributeNames: {
        '#stepKey': stepKey
      },
      ExpressionAttributeValues: {
        ':currentStep': step,
        ':stepData': {
          status,
          timestamp: now,
          ...(error && { error })
        },
        ':updatedAt': now
      }
    }));

    console.log(`[Saga] Updated saga ${sagaId} step to ${step} (${status})`);
  }

  /**
   * Mark saga as requiring compensation
   */
  async markForCompensation(
    sagaId: string,
    reason: string,
    failedStep: SagaStep
  ): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { sagaId },
      UpdateExpression: `SET currentStep = :currentStep, compensationRequired = :required, compensationReason = :reason, updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':currentStep': failedStep,
        ':required': true,
        ':reason': reason,
        ':updatedAt': new Date().toISOString()
      }
    }));

    console.log(`[Saga] Marked saga ${sagaId} for compensation: ${reason}`);
  }

  /**
   * Mark saga as completed
   */
  async markCompleted(sagaId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { sagaId },
      UpdateExpression: `SET currentStep = :currentStep, completedAt = :completedAt, updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':currentStep': SagaStep.CONFIRMED,
        ':completedAt': now,
        ':updatedAt': now
      }
    }));

    console.log(`[Saga] Completed saga ${sagaId}`);
  }

  /**
   * Mark saga as compensated
   */
  async markCompensated(sagaId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { sagaId },
      UpdateExpression: `SET currentStep = :currentStep, completedAt = :completedAt, updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ':currentStep': SagaStep.COMPENSATED,
        ':completedAt': now,
        ':updatedAt': now
      }
    }));

    console.log(`[Saga] Compensated saga ${sagaId}`);
  }

  /**
   * Get saga state by ID
   */
  async getSagaState(sagaId: string): Promise<SagaState | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { sagaId }
    }));

    return result.Item ? (result.Item as SagaState) : null;
  }

  /**
   * Get saga state by order ID
   */
  async getSagaStateByOrderId(orderId: string): Promise<SagaState | null> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'OrderIdIndex',
      KeyConditionExpression: 'orderId = :orderId',
      ExpressionAttributeValues: {
        ':orderId': orderId
      },
      Limit: 1
    }));

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as SagaState;
  }

  /**
   * Get sagas requiring compensation
   */
  async getSagasRequiringCompensation(): Promise<SagaState[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'CompensationIndex',
      KeyConditionExpression: 'compensationRequired = :required',
      ExpressionAttributeValues: {
        ':required': true
      }
    }));

    return (result.Items || []) as SagaState[];
  }

  private generateSagaId(): string {
    return `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStepKey(step: SagaStep): string {
    const keyMap: Record<SagaStep, string> = {
      [SagaStep.CREATED]: 'created',
      [SagaStep.INVENTORY_RESERVING]: 'inventoryReservation',
      [SagaStep.INVENTORY_RESERVED]: 'inventoryReservation',
      [SagaStep.INVENTORY_FAILED]: 'inventoryReservation',
      [SagaStep.PAYMENT_PROCESSING]: 'paymentProcessing',
      [SagaStep.PAYMENT_COMPLETED]: 'paymentProcessing',
      [SagaStep.PAYMENT_FAILED]: 'paymentProcessing',
      [SagaStep.CONFIRMED]: 'confirmation',
      [SagaStep.COMPENSATING]: 'compensation',
      [SagaStep.COMPENSATED]: 'compensation',
      [SagaStep.FAILED]: 'compensation'
    };

    return keyMap[step] || 'unknown';
  }
}
