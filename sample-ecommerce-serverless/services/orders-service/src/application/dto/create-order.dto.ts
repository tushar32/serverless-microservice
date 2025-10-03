/**
 * Data Transfer Objects (DTOs)
 * 
 * These define the shape of data coming in from API requests
 * and going out in API responses.
 */

export interface CreateOrderItemDTO {
  productId: string;
  quantity: number;
}

export interface CreateOrderDTO {
  customerId: string;
  items: CreateOrderItemDTO[];
}

export interface OrderItemResponseDTO {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
}

export interface OrderResponseDTO {
  orderId: string;
  customerId: string;
  items: OrderItemResponseDTO[];
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
