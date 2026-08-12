import { Point } from '../entities/point.entity';
import { PointType, PointStatus, VerificationStatus } from '../../../../shared/domain/enums';

/**
 * Point Verification Domain Service
 * Handles point verification and status management logic
 */
export class PointVerificationService {
  static generateVerificationCode(): string {
    // Generate a 6-digit alphanumeric code
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static validateVerificationCode(code: string): boolean {
    return /^[A-Z0-9]{6}$/.test(code);
  }

  static determineInitialStatus(pointType: PointType): PointStatus {
    // Need help points are active immediately
    // Offer help points need moderation
    return pointType === PointType.NEED_HELP ? PointStatus.ACTIVE : PointStatus.PENDING;
  }

  static determineInitialVerificationStatus(pointType: PointType): VerificationStatus {
    // Need help points are automatically verified
    // Offer help points need verification
    return pointType === PointType.NEED_HELP ? VerificationStatus.APPROVED : VerificationStatus.PENDING;
  }

  static requiresVerificationCode(point: Point): boolean {
    return point.type === PointType.OFFER_HELP && point.verificationStatus === VerificationStatus.PENDING;
  }

  static calculateExpiryDate(pointType: PointType): Date | null {
    // Points expire after 30 days by default
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    return expiryDate;
  }

  static canUserModifyPoint(point: Point, userId: string): boolean {
    return point.createdById === userId;
  }

  static canModeratorModifyPoint(point: Point): boolean {
    // Moderators can only modify offer help points
    return point.type === PointType.OFFER_HELP;
  }

  static getPublicStatuses(): PointStatus[] {
    return [PointStatus.ACTIVE, PointStatus.RESOLVED];
  }

  static filterPublicPoints(points: Point[]): Point[] {
    return points.filter(point => point.isPublic());
  }
}