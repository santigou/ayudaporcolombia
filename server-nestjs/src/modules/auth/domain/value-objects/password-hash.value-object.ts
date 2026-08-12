import { ValueObject } from '../../../../shared/domain/base/entity.base';

export interface PasswordHashProps {
  value: string;
}

/**
 * PasswordHash Value Object
 * Encapsulates password hashing logic
 */
export class PasswordHash extends ValueObject {
  private static readonly MIN_LENGTH = 60; // bcrypt hash length
  private static readonly MAX_LENGTH = 72; // bcrypt max input length

  private constructor(props: PasswordHashProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(hash: string): PasswordHash {
    if (!hash || hash.length < PasswordHash.MIN_LENGTH) {
      throw new Error('Invalid password hash');
    }

    return new PasswordHash({ value: hash });
  }

  static async hash(password: string): Promise<PasswordHash> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (password.length > PasswordHash.MAX_LENGTH) {
      throw new Error(`Password must not exceed ${PasswordHash.MAX_LENGTH} characters`);
    }

    // This should use bcrypt in the actual implementation
    // For now, we'll use a simple placeholder
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);

    return new PasswordHash({ value: hash });
  }

  async compare(password: string): Promise<boolean> {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, this.props.value);
  }
}