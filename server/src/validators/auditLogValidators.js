import { z } from 'zod';

export const auditActionEnum = z.enum([
  'BATCH_CREATE',
  'BATCH_EDIT',
  'BATCH_DELETE',
  'ASSIGN',
  'REASSIGN',
  'ENTRY_CREATE',
  'ENTRY_CORRECT',
  'ENTRY_ADMIN_EDIT',
  'ENTRY_ADMIN_DELETE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DEACTIVATE',
  'PASSWORD_RESET',
  'MASTER_CHANGE',
]);

export const listAuditLogsSchema = {
  query: z
    .object({
      action: auditActionEnum.optional(),
      user: z.string().trim().optional(),
      user_id: z.string().uuid().optional(),
      batch: z.string().trim().optional(),
      search: z.string().trim().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
      format: z.string().optional(),
    })
    .passthrough(),
};

