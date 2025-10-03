import { ValueObject } from '@shared/domain-primitives';

interface PriceProps {
  amount: number;
  currency: string;
}

/**
 * Price Value Object (Catalog Context)
 * 
 * Similar to Money in Orders context, but specific to Catalog.
 * This demonstrates how each bounded context has its own vocabulary.
 */
export class Price extends ValueObject<PriceProps> {
  
  private constructor(props: PriceProps) {
    super(props);
  }

  static create(amount: number, currency: string = 'USD'): Price {
    if (amount < 0) {
      throw new Error('Price cannot be negative');
    }

    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter ISO code');
    }

    return new Price({ 
      amount: Math.round(amount * 100) / 100, // Round to 2 decimals
      currency: currency.toUpperCase() 
    });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  applyDiscount(percentage: number): Price {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }

    const discountedAmount = this.amount * (1 - percentage / 100);
    return Price.create(discountedAmount, this.currency);
  }

  increaseBy(percentage: number): Price {
    if (percentage < 0) {
      throw new Error('Increase percentage cannot be negative');
    }

    const increasedAmount = this.amount * (1 + percentage / 100);
    return Price.create(increasedAmount, this.currency);
  }

  isFree(): boolean {
    return this.amount === 0;
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  toJSON() {
    return {
      amount: this.amount,
      currency: this.currency
    };
  }
}
