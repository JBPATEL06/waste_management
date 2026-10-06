import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address format'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .refine((val) => /[A-Za-z]/.test(val) && /[0-9]/.test(val), {
          message: 'Password must contain at least one letter and one number',
        }),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password cannot match your current password',
      path: ['newPassword'],
    }),
};

