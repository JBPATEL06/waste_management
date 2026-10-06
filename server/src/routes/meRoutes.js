import { Router } from 'express';
import * as entryController from '../controllers/entryController.js';
import * as userController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateMeSchema } from '../validators/userValidators.js';

const router = Router();

router.use(authenticate);

router.get('/', userController.getMe);
router.patch('/', validate(updateMeSchema), userController.updateMe);
router.get('/history', entryController.getMyHistory);

export default router;

