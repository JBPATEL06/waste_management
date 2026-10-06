import { Router } from 'express';
import * as masterController from '../controllers/masterController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { masterIdParamSchema, masterTypeParamSchema } from '../validators/masterValidators.js';

const router = Router();

// All master routes require authentication
router.use(authenticate);

// GET /master/:type is allowed for all logged-in roles (for dropdowns)
router.get(
  '/:type',
  validate(masterTypeParamSchema),
  masterController.listMaster
);

// Mutating endpoints (POST, PATCH, DELETE) are strictly ADMIN only
router.post(
  '/:type',
  requireRole('ADMIN'),
  validate(masterTypeParamSchema),
  masterController.createMaster
);

router.patch(
  '/:type/:id',
  requireRole('ADMIN'),
  validate(masterIdParamSchema),
  masterController.updateMaster
);

router.delete(
  '/:type/:id',
  requireRole('ADMIN'),
  validate(masterIdParamSchema),
  masterController.deleteMaster
);

export default router;

