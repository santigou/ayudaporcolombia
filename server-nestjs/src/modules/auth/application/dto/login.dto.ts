import { z } from 'zod';

export const LoginDtoSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    contactInfo?: string;
  };
  token: string;
}