import * as batchService from '../services/batchService.js';

export async function createBatch(req, res, next) {
  try {
    const result = await batchService.createBatch(req.body, req.user.id);
    return res.status(201).json({
      message: 'Batch created successfully',
      batch: result.batch,
      assignments: result.assignments,
    });
  } catch (err) {
    next(err);
  }
}

export async function listBatches(req, res, next) {
  try {
    const result = await batchService.listBatches(req.user, req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getBatchById(req, res, next) {
  try {
    const result = await batchService.getBatchByIdOrCode(req.params.id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateBatch(req, res, next) {
  try {
    const updated = await batchService.updateBatch(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      message: 'Batch updated successfully',
      batch: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function reassignBatch(req, res, next) {
  try {
    const result = await batchService.reassignBatch(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      message: 'Batch reassigned successfully',
      assignment: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getBatchQr(req, res, next) {
  try {
    const qrData = await batchService.getBatchQr(req.params.id);
    return res.status(200).json(qrData);
  } catch (err) {
    next(err);
  }
}

