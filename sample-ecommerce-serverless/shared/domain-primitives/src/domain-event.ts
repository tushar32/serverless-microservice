export interface DomainEvent {
  eventType: string;
  aggregateId: string;
  occurredOn: Date;
  eventData: any;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly eventData: any
  ) {
    this.occurredOn = new Date();
  }
}
