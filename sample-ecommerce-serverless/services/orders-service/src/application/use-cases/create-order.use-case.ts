import { Order } from '../../domain/models/order';
import { OrderItem } from '../../domain/models/order-item';
import { Money } from '../../domain/models/value-objects/money';
import { IOrderRepository } from '../../domain/repositories/order-repository';
import { CatalogClient } from '../../infrastructure/http/catalog-client';
import { EventPublisher } from '../../infrastructure/events/event-publisher';
import { CreateOrderDTO, OrderResponseDTO } from '../dto/create-order.dto';
import { OutboxRepository } from '../../infrastructure/database/outbox-repository';
import { SagaStateRepository } from '../../infrastructure/database/saga-state-repository';
import { DynamoDBOrderRepository } from '../../infrastructure/database/dynamodb-order-repository';

/**
 * Create Order Use Case (with Distributed Transaction Support)
 * 
 * This is the Application Service that orchestrates the business flow.
 * It coordinates between:
 * - Domain models (Order, OrderItem)
 * - External services (CatalogClient)
 * - Repository (persistence)
 * - Outbox pattern (reliable event publishing)
 * - Saga state tracking (distributed transaction monitoring)
 * 
 * This follows Clean Architecture / Hexagonal Architecture patterns
 * with Saga pattern for distributed transactions.
 */
export class CreateOrderUseCase {
  constructor(
    private orderRepository: DynamoDBOrderRepository,
    private catalogClient: CatalogClient,
    private eventPublisher: EventPublisher,
    private outboxRepository: OutboxRepository,
    private sagaStateRepository: SagaStateRepository
  ) {}

  async execute(dto: CreateOrderDTO): Promise<OrderResponseDTO> {
    console.log('[CreateOrderUseCase] Starting order creation', {
      customerId: dto.customerId,
      itemCount: dto.items.length
    });

    // Step 1: Validate input
    this.validateInput(dto);

    // Step 2: Get product details from Catalog service
    // This is inter-service communication with caching via Undici
    const productIds = dto.items.map(item => item.productId);
    const products = await this.catalogClient.getProducts(productIds);

    // Step 3: Validate all products exist and are available
    for (const item of dto.items) {
      const product = products.get(item.productId);
      
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (!product.available) {
        throw new Error(`Product ${item.productId} is not available`);
      }
    }

    // Step 4: Create OrderItems (domain entities)
    const orderItems = dto.items.map(item => {
      const product = products.get(item.productId)!;
      
      return OrderItem.create(
        product.productId,
        product.name,
        item.quantity,
        Money.create(product.price, product.currency)
      );
    });

    // Step 5: Create Order aggregate
    // The Order aggregate enforces all business rules
    const order = Order.create(dto.customerId, orderItems);

    // Step 6: Create saga state for distributed transaction tracking
    const sagaState = await this.sagaStateRepository.createSagaState(order.orderId);

    console.log('[CreateOrderUseCase] Created saga', {
      sagaId: sagaState.sagaId,
      orderId: order.orderId
    });

    // Step 7: Save order + events atomically using Outbox pattern
    // This ensures order and events are saved in a single transaction
    const orderItem = this.orderRepository['toDatabase'](order);
    await this.outboxRepository.saveOrderWithEvents(order, orderItem);

    console.log('[CreateOrderUseCase] Order created with outbox', {
      orderId: order.orderId,
      totalAmount: order.totalAmount.toString(),
      eventsCount: order.domainEvents.length
    });

    // Clear events after saving to outbox
    order.clearEvents();

    // Note: Events will be published asynchronously by outbox-publisher Lambda
    // This ensures reliable event delivery even if this Lambda crashes

    // Step 8: Return DTO
    return this.toDTO(order);
  }

  /**
   * Validate input DTO
   */
  private validateInput(dto: CreateOrderDTO): void {
    if (!dto.customerId) {
      throw new Error('Customer ID is required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    for (const item of dto.items) {
      if (!item.productId) {
        throw new Error('Product ID is required for all items');
      }

      if (item.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
    }
  }

  /**
   * Map domain model to DTO
   */
  private toDTO(order: Order): OrderResponseDTO {
    return {
      orderId: order.orderId,
      customerId: order.customerId,
      items: order.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        lineTotal: item.lineTotal.amount,
        currency: item.unitPrice.currency
      })),
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency,
      status: order.status.toString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    };
  }
}
