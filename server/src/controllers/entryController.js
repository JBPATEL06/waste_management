import * as entryService from '../services/entryService.js';

export async function createEntry(req, res, next) {
  try {
    const batchId = req.params.id || req.params.batchId;
    const result = await entryService.createEntry(batchId, req.body, req.user);
    return res.status(201).json({
      message: `${result.entry.stage} stage entry recorded successfully`,
      entry: result.entry,
      detail: result.detail,
      batch: result.batch,
    });
  } catch (err) {
    next(err);
  }
}

export async function correctEntry(req, res, next) {
  try {
    const result = await entryService.correctEntry(req.params.id, req.body, req.user);
    return res.status(200).json({
      message: 'Correction entry submitted successfully',
      entry: result.entry,
      detail: result.detail,
      batch: result.batch,
    });
  } catch (err) {
    next(err);
  }
}

export async function adminEditEntry(req, res, next) {
  try {
    const result = await entryService.adminEditEntry(req.params.id, req.body, req.user.id);
    return res.status(200).json({
      message: 'Stage entry updated by administrator',
      entry: result.entry,
      detail: result.detail,
      batch: result.batch,
    });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteEntry(req, res, next) {
  try {
    const result = await entryService.adminDeleteEntry(req.params.id, req.body.reason, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMyHistory(req, res, next) {
  try {
    const result = await entryService.getMyHistory(req.user, req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

