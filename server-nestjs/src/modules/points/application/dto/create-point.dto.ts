import { z } from 'zod';
import { PointType, PointLocationType, ContactType, AttachmentType } from '../../../../shared/domain/enums';

export const LocationDtoSchema = z.object({
  city: z.string().min(1, 'City is required').max(100, 'City must not exceed 100 characters'),
  neighborhood: z.string().min(1, 'Neighborhood is required').max(100, 'Neighborhood must not exceed 100 characters'),
  address: z.string().max(300, 'Address must not exceed 300 characters').optional(),
  latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  type: z.nativeEnum(PointLocationType),
});

export const ContactDtoSchema = z.object({
  type: z.nativeEnum(ContactType),
  value: z.string().min(1, 'Contact value is required').max(200, 'Contact value must not exceed 200 characters'),
  isPublic: z.boolean().default(true),
});

export const SupplyDtoSchema = z.object({
  supplyId: z.string().min(1, 'Supply ID is required'),
  targetQuantity: z.number().min(0, 'Target quantity must be positive').optional(),
  receivedQuantity: z.number().min(0, 'Received quantity must be positive').optional(),
  unit: z.string().max(50, 'Unit must not exceed 50 characters').optional(),
});

export const AttachmentDtoSchema = z.object({
  url: z.string().url('Invalid URL'),
  type: z.nativeEnum(AttachmentType),
});

export const CreatePointDtoSchema = z.object({
  type: z.nativeEnum(PointType),
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title must not exceed 150 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  helpTypeId: z.string().optional(),
  locations: z.array(LocationDtoSchema).min(1, 'At least one location is required'),
  contacts: z.array(ContactDtoSchema).min(1, 'At least one contact is required'),
  supplies: z.array(SupplyDtoSchema).optional(),
  attachments: z.array(AttachmentDtoSchema).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreatePointDto = z.infer<typeof CreatePointDtoSchema>;
export type LocationDto = z.infer<typeof LocationDtoSchema>;
export type ContactDto = z.infer<typeof ContactDtoSchema>;
export type SupplyDto = z.infer<typeof SupplyDtoSchema>;
export type AttachmentDto = z.infer<typeof AttachmentDtoSchema>;