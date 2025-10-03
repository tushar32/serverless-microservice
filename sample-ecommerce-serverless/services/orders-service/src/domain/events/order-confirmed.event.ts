import { BaseDomainEvent } from '@shared/domain-primitives';

export interface OrderConfirmedEventData {
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
  confirmedAt: string;
}

export class OrderConfirmedEvent extends BaseDomainEvent {
  constructor(data: OrderConfirmedEventData) {
    super('order.confirmed', data.orderId, data);
  }
}
