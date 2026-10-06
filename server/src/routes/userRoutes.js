import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userIdParamSchema,
} from '../validators/userValidators.js';

const router = Router();

// All /users endpoints require authentication and ADMIN role
router.use(authenticate, requireRole('ADMIN'));

router.get('/', validate(listUsersSchema), userController.listUsers);
router.post('/', validate(createUserSchema), userController.createUser);
router.get('/:id', validate(userIdParamSchema), userController.getUserById);
router.patch('/:id', validate(updateUserSchema), userController.updateUser);
router.post('/:id/reset-password', validate(userIdParamSchema), userController.resetPassword);
router.post('/:id/deactivate', validate(userIdParamSchema), userController.deactivateUser);
router.post('/:id/activate', validate(userIdParamSchema), userController.activateUser);

export default router;

