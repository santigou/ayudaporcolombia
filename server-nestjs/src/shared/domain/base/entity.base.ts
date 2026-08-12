/**
 * Base Entity class for all domain entities
 * Provides common properties and identity management
 */
export abstract class Entity {
  protected constructor(protected readonly _id: string) {
    this.validateId();
  }

  get id(): string {
    return this._id;
  }

  protected validateId(): void {
    if (!this._id || this._id.trim().length === 0) {
      throw new Error('Entity ID cannot be empty');
    }
  }

  abstract equals(entity: Entity): boolean;
}

/**
 * Base Aggregate Root class
 * Aggregates encapsulate business invariants and maintain consistency
 */
export abstract class AggregateRoot extends Entity {
  constructor(id: string) {
    super(id);
  }

  equals(entity: Entity): boolean {
    return this.id === entity.id && this.constructor === entity.constructor;
  }
}

/**
 * Base Value Object class
 * Value Objects are immutable and defined by their attributes
 */
export abstract class ValueObject {
  protected constructor(protected readonly props: any) {}

  public equals(vo: ValueObject): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }

    if (vo.constructor !== this.constructor) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}

/**
 * Base Repository Interface
 * Defines common repository operations
 */
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: any): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Domain Event Interface
 * For implementing Domain-Driven Design event patterns
 */
export interface IDomainEvent {
  occurredAt: Date;
  aggregateId: string;
}

export abstract class DomainEvent implements IDomainEvent {
  public readonly occurredAt: Date;
  public readonly aggregateId: string;

  constructor(aggregateId: string) {
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
  }

  abstract get eventName(): string;
}