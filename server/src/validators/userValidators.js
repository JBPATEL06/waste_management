import { z } from 'zod';

export const userRoleEnum = z.enum([
  'ADMIN',
  'COLLECTION',
  'TRANSPORTATION',
  'RTS',
  'PROCESSING',
  'HEAD_OFFICER',
]);

export const createUserSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: z.string().trim().email('Invalid email address format'),
    role: userRoleEnum,
  }),
};

export const updateUserSchema = {
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().trim().email('Invalid email address format').optional(),
    role: userRoleEnum.optional(),
  }),
};

export const updateMeSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  }),
};

export const userIdParamSchema = {
  params: z.object({
    id: z.string().uuid('Invalid user ID format'),
  }),
};

export const listUsersSchema = {
  query: z.object({
    role: userRoleEnum.optional(),
    status: z.enum(['active', 'inactive', 'all']).optional(),
    search: z.string().trim().optional(),
    limit: z.coerce.number().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().min(0).default(0).optional(),
  }),
};

