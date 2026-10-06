import { Router } from 'express';
import * as entryController from '../controllers/entryController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adminDeleteEntrySchema,
  adminEditEntrySchema,
  correctEntrySchema,
} from '../validators/entryValidators.js';

const router = Router();

router.use(authenticate);

// Correction by stage user (own stage) or Admin
router.post('/:id/correct', validate(correctEntrySchema), entryController.correctEntry);

// Admin-only entry modifications
router.patch('/:id', requireRole('ADMIN'), validate(adminEditEntrySchema), entryController.adminEditEntry);
router.delete('/:id', requireRole('ADMIN'), validate(adminDeleteEntrySchema), entryController.adminDeleteEntry);

export default router;

