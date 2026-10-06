import * as masterService from '../services/masterService.js';

export async function listMaster(req, res, next) {
  try {
    const { type } = req.params;
    const includeInactive = req.user?.role === 'ADMIN' && req.query.include_inactive === 'true';
    const items = await masterService.listMaster(type, { includeInactive });
    return res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

export async function createMaster(req, res, next) {
  try {
    const { type } = req.params;
    const item = await masterService.createMaster(type, req.body, req.user.id);
    return res.status(201).json({
      message: 'Master record created successfully',
      item,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMaster(req, res, next) {
  try {
    const { type, id } = req.params;
    const item = await masterService.updateMaster(type, id, req.body, req.user.id);
    return res.status(200).json({
      message: 'Master record updated successfully',
      item,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteMaster(req, res, next) {
  try {
    const { type, id } = req.params;
    const result = await masterService.deleteMaster(type, id, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

