import { Router } from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Admin & Head Officer Analytics Dashboards
router.get('/summary', requireRole('ADMIN', 'HEAD_OFFICER'), dashboardController.getSummary);
router.get('/breakdowns', requireRole('ADMIN', 'HEAD_OFFICER'), dashboardController.getBreakdowns);
router.get('/pending', requireRole('ADMIN', 'HEAD_OFFICER'), dashboardController.getPending);
router.get('/recent', requireRole('ADMIN', 'HEAD_OFFICER'), dashboardController.getRecent);

// Stage Operator Queue Dashboard
router.get(
  '/queue',
  requireRole('COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'),
  dashboardController.getQueue
);

export default router;

