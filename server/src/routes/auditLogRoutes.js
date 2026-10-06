import { Router } from 'express';
import * as auditLogController from '../controllers/auditLogController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'HEAD_OFFICER'));

router.get('/', auditLogController.listAuditLogs);

export default router;

