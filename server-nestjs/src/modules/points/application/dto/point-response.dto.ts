import { z } from 'zod';
import { PointType, PointStatus, VerificationStatus, PointLocationType, ContactType, AttachmentType } from '../../../../shared/domain/enums';

export const LocationResponseDtoSchema = z.object({
  id: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  address: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  type: z.nativeEnum(PointLocationType),
});

export const ContactResponseDtoSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ContactType),
  value: z.string(),
  isPublic: z.boolean(),
});

export const AttachmentResponseDtoSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.nativeEnum(AttachmentType),
  createdAt: z.date(),
});

export const SupplyResponseDtoSchema = z.object({
  supplyId: z.string(),
  targetQuantity: z.number().nullable(),
  receivedQuantity: z.number().nullable(),
  unit: z.string().nullable(),
});

export const PointResponseDtoSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(PointType),
  title: z.string(),
  description: z.string(),
  helpTypeId: z.string().nullable(),
  status: z.nativeEnum(PointStatus),
  verificationStatus: z.nativeEnum(VerificationStatus),
  createdById: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().nullable(),
  locations: z.array(LocationResponseDtoSchema),
  contacts: z.array(ContactResponseDtoSchema),
  supplies: z.array(SupplyResponseDtoSchema).optional(),
  attachments: z.array(AttachmentResponseDtoSchema).optional(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }).nullable().optional(),
});

export type LocationResponseDto = z.infer<typeof LocationResponseDtoSchema>;
export type ContactResponseDto = z.infer<typeof ContactResponseDtoSchema>;
export type AttachmentResponseDto = z.infer<typeof AttachmentResponseDtoSchema>;
export type SupplyResponseDto = z.infer<typeof SupplyResponseDtoSchema>;
export type PointResponseDto = z.infer<typeof PointResponseDtoSchema>;