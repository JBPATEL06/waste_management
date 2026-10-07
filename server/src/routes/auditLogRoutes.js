import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listAuditLogsSchema } from '../validators/auditLogValidators.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'HEAD_OFFICER'));

router.get('/', validate(listAuditLogsSchema), auditLogController.listAuditLogs);

export default router;

