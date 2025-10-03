import { AggregateRoot } from '@shared/domain-primitives';
import { OrderItem } from './order-item';
import { Money } from './value-objects/money';
import { OrderStatus, OrderStatusType } from './value-objects/order-status';
import { OrderCreatedEvent } from '../events/order-created.event';
import { OrderConfirmedEvent } from '../events/order-confirmed.event';
import { OrderCancelledEvent } from '../events/order-cancelled.event';

export interface OrderProps {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: Money;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order Aggregate Root
 * 
 * This is the main aggregate that enforces business rules
 * for order creation and management.
 */
export class Order extends AggregateRoot<OrderProps> {
  
  private constructor(props: OrderProps, id: string) {
    super(props, id);
  }

  /**
   * Factory method to create a new Order
   * This is the ONLY way to create an order
   */
  static create(
    customerId: string,
    items: OrderItem[]
  ): Order {
    // Business Rule: Order must have at least one item
    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Business Rule: Customer ID is required
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const orderId = this.generateId();
    const totalAmount = this.calculateTotal(items);
    const now = new Date();

    const order = new Order(
      {
        orderId,
        customerId,
        items,
        totalAmount,
        status: OrderStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      orderId
    );

    // Add domain event
    order.addDomainEvent(
      new OrderCreatedEvent({
        orderId: order.id,
        customerId: order.customerId,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice.amount
        })),
        totalAmount: totalAmount.amount,
        currency: totalAmount.currency
      })
    );

    return order;
  }

  /**
   * Reconstitute order from persistence
   */
  static reconstitute(props: OrderProps): Order {
    return new Order(props, props.orderId);
  }

  // Getters
  get orderId(): string {
    return this.props.orderId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get items(): OrderItem[] {
    return [...this.props.items]; // Return copy to prevent mutation
  }

  get totalAmount(): Money {
    return this.props.totalAmount;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Business logic: Confirm the order
   */
  confirm(): void {
    if (!this.status.canTransitionTo(OrderStatus.CONFIRMED)) {
      throw new Error(`Cannot confirm order in ${this.status} status`);
    }

    this.props.status = OrderStatus.CONFIRMED;
    this.props.updatedAt = new Date();

    // Add domain event
    this.addDomainEvent(
      new OrderConfirmedEvent({
        orderId: this.orderId,
        customerId: this.customerId,
        totalAmount: this.totalAmount.amount,
        currency: this.totalAmount.currency,
        confirmedAt: this.props.updatedAt.toISOString()
      })
    );
  }

  /**
   * Business logic: Complete the order
   */
  complete(): void {
    if (!this.status.canTransitionTo(OrderStatus.COMPLETED)) {
      throw new Error(`Cannot complete order in ${this.status} status`);
    }

    this.props.status = OrderStatus.COMPLETED;
    this.props.updatedAt = new Date();

    // Add domain event for completion
    this.addDomainEvent(
      new OrderCreatedEvent({
        orderId: this.orderId,
        customerId: this.customerId,
        items: [],
        totalAmount: this.totalAmount.amount,
        currency: this.totalAmount.currency
      })
    );
  }

  /**
   * Business logic: Cancel the order
   */
  cancel(reason: string): void {
    if (!this.status.canTransitionTo(OrderStatus.CANCELLED)) {
      throw new Error(`Cannot cancel order in ${this.status} status`);
    }

    if (this.status.isFinal()) {
      throw new Error('Cannot cancel a completed or already cancelled order');
    }

    this.props.status = OrderStatus.CANCELLED;
    this.props.updatedAt = new Date();

    // Add domain event
    this.addDomainEvent(
      new OrderCancelledEvent({
        orderId: this.orderId,
        customerId: this.customerId,
        reason,
        cancelledAt: this.props.updatedAt.toISOString()
      })
    );
  }

  /**
   * Add item to order (only if pending)
   */
  addItem(item: OrderItem): void {
    if (!this.status.isPending()) {
      throw new Error('Can only add items to pending orders');
    }

    this.props.items.push(item);
    this.props.totalAmount = Order.calculateTotal(this.props.items);
    this.props.updatedAt = new Date();
  }

  /**
   * Remove item from order (only if pending)
   */
  removeItem(productId: string): void {
    if (!this.status.isPending()) {
      throw new Error('Can only remove items from pending orders');
    }

    this.props.items = this.props.items.filter(
      item => item.productId !== productId
    );

    if (this.props.items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    this.props.totalAmount = Order.calculateTotal(this.props.items);
    this.props.updatedAt = new Date();
  }

  /**
   * Calculate total amount from items
   */
  private static calculateTotal(items: OrderItem[]): Money {
    if (items.length === 0) {
      return Money.create(0);
    }

    return items.reduce(
      (total, item) => total.add(item.lineTotal),
      Money.create(0, items[0].unitPrice.currency)
    );
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      orderId: this.orderId,
      customerId: this.customerId,
      items: this.items.map(item => item.toJSON()),
      totalAmount: this.totalAmount.toJSON(),
      status: this.status.toString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
