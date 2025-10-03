import { BaseDomainEvent } from '@shared/domain-primitives';

export interface InventoryReservationFailedEventData {
  orderId: string;
  reason: string;
  failedAt: string;
}

export class InventoryReservationFailedEvent extends BaseDomainEvent {
  constructor(data: InventoryReservationFailedEventData) {
    super('inventory.reservation.failed', data.orderId, data);
  }
}
