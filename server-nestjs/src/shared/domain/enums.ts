/**
 * Domain Enums
 * Centralized enum definitions for the application
 */

export enum Role {
  USER = 'user',
  MODERATOR = 'moderator',
}

export enum PointType {
  NEED_HELP = 'need_help',
  OFFER_HELP = 'offer_help',
}

export enum PointStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PointLocationType {
  LOCATION = 'location',
  ORIGIN = 'origin',
  DESTINATION = 'destination',
}

export enum ContactType {
  PHONE = 'phone',
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  EMAIL = 'email',
  OTHER = 'other',
}

export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export enum ValidationStatus {
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}