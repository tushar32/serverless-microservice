export interface CircuitBreakerConfig {
  threshold: number;
  timeout: number;
}

enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.config.timeout) {
        console.log('Circuit breaker: OPEN -> HALF_OPEN');
        this.state = CircuitBreakerState.HALF_OPEN;
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN state
  }

  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      console.log('Circuit breaker: HALF_OPEN -> CLOSED');
      this.state = CircuitBreakerState.CLOSED;
    }
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.threshold) {
      console.log(`Circuit breaker: ${this.state} -> OPEN`);
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): string {
    return this.state;
  }
}
