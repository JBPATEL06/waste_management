import { Router } from 'express';
import { publicLimiter } from '../middleware/rateLimiter.js';
import * as publicService from '../services/publicService.js';

const router = Router();

router.get('/track/:batchCode', publicLimiter, async (req, res, next) => {
  try {
    const data = await publicService.getPublicTracking(req.params.batchCode);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

