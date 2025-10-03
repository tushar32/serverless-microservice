import { BaseDomainEvent } from '@shared/domain-primitives';

export interface InventoryReservedEventData {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  reservedAt: string;
}

export class InventoryReservedEvent extends BaseDomainEvent {
  constructor(data: InventoryReservedEventData) {
    super('inventory.reserved', data.orderId, data);
  }
}
