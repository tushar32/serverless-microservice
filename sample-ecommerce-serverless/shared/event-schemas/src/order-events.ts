/**
 * Order Domain Events
 * 
 * These events are published by the Orders bounded context
 * and consumed by other contexts (Rewards, Inventory, etc.)
 */

export interface OrderCreatedEvent {
  eventType: 'order.created';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      priceAtPurchase: number;
    }>;
    totalAmount: number;
    currency: string;
    status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  };
  metadata: {
    correlationId: string;
    source: 'orders-service';
  };
}

export interface OrderCompletedEvent {
  eventType: 'order.completed';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    orderId: string;
    customerId: string;
    totalAmount: number;
    currency: string;
    completedAt: string;
  };
  metadata: {
    correlationId: string;
    source: 'orders-service';
  };
}

export interface OrderCancelledEvent {
  eventType: 'order.cancelled';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    orderId: string;
    customerId: string;
    reason: string;
    cancelledAt: string;
  };
  metadata: {
    correlationId: string;
    source: 'orders-service';
  };
}

export type OrderEvent = 
  | OrderCreatedEvent 
  | OrderCompletedEvent 
  | OrderCancelledEvent;
