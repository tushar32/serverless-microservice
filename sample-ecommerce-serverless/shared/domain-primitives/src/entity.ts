export abstract class Entity<T> {
  protected readonly props: T;
  protected readonly _id: string;

  constructor(props: T, id: string) {
    this.props = props;
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  public equals(entity?: Entity<T>): boolean {
    if (!entity) {
      return false;
    }
    return this._id === entity._id;
  }
}
