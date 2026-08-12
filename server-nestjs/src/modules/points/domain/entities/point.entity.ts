import { AggregateRoot } from '../../../../shared/domain/base/entity.base';
import { PointType, PointStatus, VerificationStatus } from '../../../../shared/domain/enums';

export interface PointProps {
  id: string;
  type: PointType;
  title: string;
  description: string;
  helpTypeId?: string;
  status: PointStatus;
  verificationStatus: VerificationStatus;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Point Aggregate Root
 * Represents a help point in the system - either offering help or needing help
 */
export class Point extends AggregateRoot {
  private readonly _type: PointType;
  private readonly _title: string;
  private readonly _description: string;
  private readonly _helpTypeId?: string;
  private _status: PointStatus;
  private _verificationStatus: VerificationStatus;
  private readonly _createdById?: string;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private readonly _expiresAt?: Date;

  private constructor(props: PointProps) {
    super(props.id);
    this._type = props.type;
    this._title = props.title;
    this._description = props.description;
    this._helpTypeId = props.helpTypeId;
    this._status = props.status;
    this._verificationStatus = props.verificationStatus;
    this._createdById = props.createdById;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._expiresAt = props.expiresAt;
  }

  get type(): PointType {
    return this._type;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get helpTypeId(): string | undefined {
    return this._helpTypeId;
  }

  get status(): PointStatus {
    return this._status;
  }

  get verificationStatus(): VerificationStatus {
    return this._verificationStatus;
  }

  get createdById(): string | undefined {
    return this._createdById;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get expiresAt(): Date | undefined {
    return this._expiresAt;
  }

  approve(): void {
    if (this._status !== PointStatus.PENDING) {
      throw new Error('Can only approve pending points');
    }
    this._status = PointStatus.ACTIVE;
    this._verificationStatus = VerificationStatus.APPROVED;
  }

  reject(): void {
    if (this._status !== PointStatus.PENDING) {
      throw new Error('Can only reject pending points');
    }
    this._status = PointStatus.REJECTED;
    this._verificationStatus = VerificationStatus.REJECTED;
  }

  resolve(): void {
    if (this._status !== PointStatus.ACTIVE) {
      throw new Error('Can only resolve active points');
    }
    this._status = PointStatus.RESOLVED;
  }

  cancel(): void {
    if (this._status === PointStatus.RESOLVED || this._status === PointStatus.REJECTED) {
      throw new Error('Cannot cancel resolved or rejected points');
    }
    this._status = PointStatus.CANCELLED;
  }

  isExpired(): boolean {
    return this._expiresAt ? new Date() > this._expiresAt : false;
  }

  isPublic(): boolean {
    // Need help points are public immediately
    // Offer help points need approval
    if (this._type === PointType.NEED_HELP) {
      return [PointStatus.ACTIVE, PointStatus.RESOLVED].includes(this._status);
    }
    return this._status === PointStatus.ACTIVE;
  }

  requiresModeration(): boolean {
    return this._type === PointType.OFFER_HELP;
  }

  static create(props: PointProps): Point {
    Point.validateTitle(props.title);
    Point.validateDescription(props.description);

    return new Point(props);
  }

  private static validateTitle(title: string): void {
    if (!title || title.trim().length < 3) {
      throw new Error('Title must be at least 3 characters long');
    }
    if (title.trim().length > 150) {
      throw new Error('Title must not exceed 150 characters');
    }
  }

  private static validateDescription(description: string): void {
    if (!description || description.trim().length < 10) {
      throw new Error('Description must be at least 10 characters long');
    }
    if (description.trim().length > 2000) {
      throw new Error('Description must not exceed 2000 characters');
    }
  }

  toPlainObject() {
    return {
      id: this.id,
      type: this._type,
      title: this._title,
      description: this._description,
      helpTypeId: this._helpTypeId,
      status: this._status,
      verificationStatus: this._verificationStatus,
      createdById: this._createdById,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      expiresAt: this._expiresAt,
    };
  }
}