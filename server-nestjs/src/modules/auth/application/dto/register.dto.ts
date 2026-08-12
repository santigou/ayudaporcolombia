import { z } from 'zod';

export const RegisterDtoSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  contactInfo: z.string().max(200, 'Contact info must not exceed 200 characters').optional(),
  wantsModerator: z.boolean().optional(),
});

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;