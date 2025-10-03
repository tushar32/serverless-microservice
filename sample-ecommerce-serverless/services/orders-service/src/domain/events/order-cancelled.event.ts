import { BaseDomainEvent } from '@shared/domain-primitives';

export interface OrderCancelledEventData {
  orderId: string;
  customerId: string;
  reason: string;
  cancelledAt: string;
}

export class OrderCancelledEvent extends BaseDomainEvent {
  constructor(data: OrderCancelledEventData) {
    super('order.cancelled', data.orderId, data);
  }
}
