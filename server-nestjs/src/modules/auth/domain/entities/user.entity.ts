import { AggregateRoot } from '../../../../shared/domain/base/entity.base';
import { Role } from '../../../../shared/domain/enums';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  contactInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Aggregate Root
 * Represents a user in the system with authentication and authorization capabilities
 */
export class User extends AggregateRoot {
  private readonly _name: string;
  private readonly _email: string;
  private readonly _passwordHash: string;
  private readonly _role: Role;
  private readonly _contactInfo?: string;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: UserProps) {
    super(props.id);
    this._name = props.name;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._role = props.role;
    this._contactInfo = props.contactInfo;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): Role {
    return this._role;
  }

  get contactInfo(): string | undefined {
    return this._contactInfo;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isModerator(): boolean {
    return this._role === Role.MODERATOR;
  }

  canModerate(): boolean {
    return this._role === Role.MODERATOR;
  }

  static create(props: UserProps): User {
    User.validateEmail(props.email);
    User.validateName(props.name);
    User.validatePasswordHash(props.passwordHash);

    return new User(props);
  }

  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  private static validateName(name: string): void {
    if (!name || name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }
    if (name.trim().length > 100) {
      throw new Error('Name must not exceed 100 characters');
    }
  }

  private static validatePasswordHash(passwordHash: string): void {
    if (!passwordHash || passwordHash.length < 60) {
      throw new Error('Invalid password hash');
    }
  }

  toPlainObject() {
    return {
      id: this.id,
      name: this._name,
      email: this._email,
      role: this._role,
      contactInfo: this._contactInfo,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}