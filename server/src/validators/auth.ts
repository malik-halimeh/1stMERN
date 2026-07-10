import { z } from 'zod';

// Password criteria: >= 8 characters, at least 1 uppercase letter, and at least 1 number
export const RegisterValidator = z.object({
  name: z.string().trim().min(1, { message: 'Name is required' }),
  email: z.string().trim().email({ message: 'Invalid email address format' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Password must contain at least one uppercase letter',
    })
    .refine((val) => /[0-9]/.test(val), {
      message: 'Password must contain at least one number',
    }),
});

export const LoginValidator = z.object({
  email: z.string().trim().email({ message: 'Invalid email address format' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

export const ForgotPasswordValidator = z.object({
  email: z.string().trim().email({ message: 'Invalid email address format' }),
});

export const ResetPasswordValidator = z.object({
  email: z.string().trim().email({ message: 'Invalid email address format' }),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: 'The reset code must be 6 digits' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Password must contain at least one uppercase letter',
    })
    .refine((val) => /[0-9]/.test(val), {
      message: 'Password must contain at least one number',
    }),
});
