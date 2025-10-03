/**
 * Catalog Domain Events
 * 
 * These events are published by the Catalog bounded context
 */

export interface ProductCreatedEvent {
  eventType: 'product.created';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    productId: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    sku: string;
    category: string;
  };
  metadata: {
    correlationId: string;
    source: 'catalog-service';
  };
}

export interface ProductUpdatedEvent {
  eventType: 'product.updated';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    productId: string;
    changes: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
  };
  metadata: {
    correlationId: string;
    source: 'catalog-service';
  };
}

export interface ProductPriceChangedEvent {
  eventType: 'product.price.changed';
  eventVersion: '1.0';
  timestamp: string;
  data: {
    productId: string;
    oldPrice: number;
    newPrice: number;
    currency: string;
    effectiveDate: string;
  };
  metadata: {
    correlationId: string;
    source: 'catalog-service';
  };
}

export type CatalogEvent = 
  | ProductCreatedEvent 
  | ProductUpdatedEvent 
  | ProductPriceChangedEvent;
