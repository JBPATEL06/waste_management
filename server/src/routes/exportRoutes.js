import { Router } from 'express';
import * as exportController from '../controllers/exportController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'HEAD_OFFICER'));

router.get('/:dataset', exportController.exportDataset);

export default router;

