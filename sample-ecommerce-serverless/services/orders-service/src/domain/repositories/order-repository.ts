import { Order } from '../models/order';

/**
 * Order Repository Interface (Domain Layer)
 * 
 * This is the contract that infrastructure must implement.
 * It's defined in the domain layer to maintain dependency inversion.
 */
export interface IOrderRepository {
  /**
   * Save an order (create or update)
   */
  save(order: Order): Promise<Order>;

  /**
   * Find order by ID
   */
  findById(orderId: string): Promise<Order | null>;

  /**
   * Find all orders for a customer
   */
  findByCustomerId(customerId: string): Promise<Order[]>;

  /**
   * Find orders by status
   */
  findByStatus(status: string): Promise<Order[]>;

  /**
   * Delete an order
   */
  delete(orderId: string): Promise<void>;

  /**
   * Check if order exists
   */
  exists(orderId: string): Promise<boolean>;
}
