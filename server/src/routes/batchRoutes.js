import { Router } from 'express';
import * as batchController from '../controllers/batchController.js';
import * as entryController from '../controllers/entryController.js';
import { authenticate, requireAssignment, requireRole, stageGuard } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createBatchSchema,
  deleteBatchSchema,
  listBatchesSchema,
  reassignSchema,
  updateBatchSchema,
} from '../validators/batchValidators.js';

const router = Router();

router.use(authenticate);

// Batch listing and details
router.get('/', validate(listBatchesSchema), batchController.listBatches);
router.post('/', requireRole('ADMIN'), validate(createBatchSchema), batchController.createBatch);

router.get('/:id', batchController.getBatchById);
router.patch('/:id', requireRole('ADMIN'), validate(updateBatchSchema), batchController.updateBatch);
router.delete('/:id', requireRole('ADMIN'), validate(deleteBatchSchema), batchController.deleteBatch);
router.put('/:id/assignments', requireRole('ADMIN'), validate(reassignSchema), batchController.reassignBatch);
router.get('/:id/qr', requireRole('ADMIN', 'HEAD_OFFICER'), batchController.getBatchQr);

// Add stage entry to batch
router.post('/:id/entries', requireAssignment, stageGuard, entryController.createEntry);

export default router;
