import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateSettingsSchema } from '../validators/settingsValidators.js';

const router = Router();

router.use(authenticate);

// GET /settings: Admin & Head Officer
router.get('/', requireRole('ADMIN', 'HEAD_OFFICER'), settingsController.getSettings);

// PATCH /settings: Admin only
router.patch('/', requireRole('ADMIN'), validate(updateSettingsSchema), settingsController.updateSettings);

export default router;

