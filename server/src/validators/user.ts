import { z } from 'zod';

const AddressValidator = z.object({
  label: z.string().trim().optional(),
  line1: z.string().trim().min(1, { message: 'Address line 1 is required' }),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, { message: 'City is required' }),
  country: z.string().trim().min(1, { message: 'Country is required' }),
  isDefault: z.boolean().optional().default(false),
});

// Password criteria mirror RegisterValidator: >= 8 characters, at least
// 1 uppercase letter, and at least 1 number
export const CreateUserValidator = z.object({
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
  role: z
    .enum(['customer', 'inventory_manager', 'super_admin'])
    .optional()
    .default('customer'),
  addresses: z.array(AddressValidator).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

// Explicit allowlist for admin updates — password is re-hashed by the
// controller; passwordHash/refreshTokenHash can never be set from outside.
// Role and isActive are deliberately excluded: those changes must go through
// the dedicated audited endpoints (PATCH /:id/role, PATCH /:id/status).
export const UpdateUserValidator = z.object({
  name: z.string().trim().min(1, { message: 'Name cannot be empty' }).optional(),
  email: z.string().trim().email({ message: 'Invalid email address format' }).optional(),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Password must contain at least one uppercase letter',
    })
    .refine((val) => /[0-9]/.test(val), {
      message: 'Password must contain at least one number',
    })
    .optional(),
  addresses: z.array(AddressValidator).optional(),
});

export const UpdateUserRoleValidator = z.object({
  role: z.enum(['customer', 'inventory_manager', 'super_admin']),
});

export const UpdateUserStatusValidator = z.object({
  isActive: z.boolean(),
});
