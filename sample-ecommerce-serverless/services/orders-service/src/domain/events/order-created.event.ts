import { BaseDomainEvent } from '@shared/domain-primitives';

export interface OrderCreatedEventData {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  currency: string;
}

export class OrderCreatedEvent extends BaseDomainEvent {
  constructor(data: OrderCreatedEventData) {
    super('order.created', data.orderId, data);
  }
}
