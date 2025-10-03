import { Entity } from '@shared/domain-primitives';
import { Money } from './value-objects/money';

export interface OrderItemProps {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

/**
 * OrderItem Entity
 * Part of Order aggregate
 */
export class OrderItem extends Entity<OrderItemProps> {
  
  private constructor(props: OrderItemProps, id: string) {
    super(props, id);
  }

  static create(
    productId: string,
    productName: string,
    quantity: number,
    unitPrice: Money
  ): OrderItem {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    if (!productId || !productName) {
      throw new Error('Product ID and name are required');
    }

    const lineTotal = unitPrice.multiply(quantity);
    const id = `${productId}-${Date.now()}`;

    return new OrderItem(
      {
        productId,
        productName,
        quantity,
        unitPrice,
        lineTotal
      },
      id
    );
  }

  get productId(): string {
    return this.props.productId;
  }

  get productName(): string {
    return this.props.productName;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPrice(): Money {
    return this.props.unitPrice;
  }

  get lineTotal(): Money {
    return this.props.lineTotal;
  }

  updateQuantity(newQuantity: number): OrderItem {
    if (newQuantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const newLineTotal = this.unitPrice.multiply(newQuantity);
    
    return new OrderItem(
      {
        ...this.props,
        quantity: newQuantity,
        lineTotal: newLineTotal
      },
      this._id
    );
  }

  toJSON() {
    return {
      productId: this.productId,
      productName: this.productName,
      quantity: this.quantity,
      unitPrice: this.unitPrice.toJSON(),
      lineTotal: this.lineTotal.toJSON()
    };
  }
}
