import { ValueObject } from '@shared/domain-primitives';

interface MoneyProps {
  amount: number;
  currency: string;
}

/**
 * Money Value Object
 * Encapsulates amount and currency
 */
export class Money extends ValueObject<MoneyProps> {
  
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: string = 'USD'): Money {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter ISO code');
    }

    return new Money({ amount, currency: currency.toUpperCase() });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies: ${this.currency} and ${other.currency}`);
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract different currencies: ${this.currency} and ${other.currency}`);
    }
    return Money.create(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(this.amount * factor, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error('Cannot compare different currencies');
    }
    return this.amount > other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  toJSON() {
    return {
      amount: this.amount,
      currency: this.currency
    };
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}
