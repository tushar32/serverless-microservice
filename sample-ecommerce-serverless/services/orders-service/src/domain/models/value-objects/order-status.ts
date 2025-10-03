import { ValueObject } from '@shared/domain-primitives';

interface OrderStatusProps {
  status: OrderStatusType;
}

export enum OrderStatusType {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * OrderStatus Value Object
 * Enforces valid order status transitions
 */
export class OrderStatus extends ValueObject<OrderStatusProps> {
  
  private constructor(props: OrderStatusProps) {
    super(props);
  }

  static create(status: OrderStatusType): OrderStatus {
    return new OrderStatus({ status });
  }

  static PENDING = new OrderStatus({ status: OrderStatusType.PENDING });
  static CONFIRMED = new OrderStatus({ status: OrderStatusType.CONFIRMED });
  static PROCESSING = new OrderStatus({ status: OrderStatusType.PROCESSING });
  static COMPLETED = new OrderStatus({ status: OrderStatusType.COMPLETED });
  static CANCELLED = new OrderStatus({ status: OrderStatusType.CANCELLED });

  get value(): OrderStatusType {
    return this.props.status;
  }

  /**
   * Check if transition to new status is valid
   */
  canTransitionTo(newStatus: OrderStatus): boolean {
    const transitions: Record<OrderStatusType, OrderStatusType[]> = {
      [OrderStatusType.PENDING]: [OrderStatusType.CONFIRMED, OrderStatusType.CANCELLED],
      [OrderStatusType.CONFIRMED]: [OrderStatusType.PROCESSING, OrderStatusType.CANCELLED],
      [OrderStatusType.PROCESSING]: [OrderStatusType.COMPLETED, OrderStatusType.CANCELLED],
      [OrderStatusType.COMPLETED]: [],
      [OrderStatusType.CANCELLED]: []
    };

    return transitions[this.value].includes(newStatus.value);
  }

  isPending(): boolean {
    return this.value === OrderStatusType.PENDING;
  }

  isCompleted(): boolean {
    return this.value === OrderStatusType.COMPLETED;
  }

  isCancelled(): boolean {
    return this.value === OrderStatusType.CANCELLED;
  }

  isFinal(): boolean {
    return this.isCompleted() || this.isCancelled();
  }

  toString(): string {
    return this.value;
  }
}
