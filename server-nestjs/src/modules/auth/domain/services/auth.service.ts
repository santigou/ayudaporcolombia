import { User } from '../entities/user.entity';
import { Role } from '../../../../shared/domain/enums';
import { PasswordHash } from '../value-objects/password-hash.value-object';

/**
 * Authentication Domain Service
 * Handles authentication-related business logic
 */
export class AuthService {
  static async authenticateUser(
    user: User,
    providedPassword: string,
  ): Promise<boolean> {
    const passwordHash = PasswordHash.create(user.passwordHash);
    return passwordHash.compare(providedPassword);
  }

  static validatePasswordRequirements(password: string): void {
    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (password.length > 100) {
      throw new Error('Password must not exceed 100 characters');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }

  static async hashPassword(password: string): Promise<string> {
    AuthService.validatePasswordRequirements(password);
    const passwordHash = await PasswordHash.hash(password);
    return passwordHash.value;
  }

  static canUserPerformAction(user: User, requiredRole: Role): boolean {
    if (requiredRole === Role.MODERATOR) {
      return user.isModerator();
    }

    return true; // Any authenticated user can perform basic actions
  }

  static validateContactInfo(contactInfo?: string): void {
    if (!contactInfo) {
      return;
    }

    if (contactInfo.trim().length > 200) {
      throw new Error('Contact info must not exceed 200 characters');
    }
  }
}