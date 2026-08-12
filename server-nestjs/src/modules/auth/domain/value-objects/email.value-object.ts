import { ValueObject } from '../../../../shared/domain/base/entity.base';

export interface EmailProps {
  value: string;
}

/**
 * Email Value Object
 * Encapsulates email validation logic
 */
export class Email extends ValueObject {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  static create(email: string): Email {
    if (!Email.isValid(email)) {
      throw new Error('Invalid email format');
    }

    return new Email({ value: email.toLowerCase().trim() });
  }

  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getDomain(): string {
    return this.props.value.split('@')[1];
  }

  getLocalPart(): string {
    return this.props.value.split('@')[0];
  }
}