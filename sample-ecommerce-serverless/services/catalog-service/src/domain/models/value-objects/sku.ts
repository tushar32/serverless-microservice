import { ValueObject } from '@shared/domain-primitives';

interface SKUProps {
  value: string;
}

/**
 * SKU (Stock Keeping Unit) Value Object
 * 
 * Business rules:
 * - Must be alphanumeric
 * - Between 6-20 characters
 * - Uppercase only
 */
export class SKU extends ValueObject<SKUProps> {
  
  private constructor(props: SKUProps) {
    super(props);
  }

  static create(value: string): SKU {
    const normalized = value.toUpperCase().trim();

    if (!normalized) {
      throw new Error('SKU cannot be empty');
    }

    if (normalized.length < 6 || normalized.length > 20) {
      throw new Error('SKU must be between 6 and 20 characters');
    }

    if (!/^[A-Z0-9-]+$/.test(normalized)) {
      throw new Error('SKU must contain only letters, numbers, and hyphens');
    }

    return new SKU({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON() {
    return this.value;
  }
}
