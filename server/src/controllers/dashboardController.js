import * as dashboardService from '../services/dashboardService.js';

export async function getSummary(req, res, next) {
  try {
    const data = await dashboardService.getSummary(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getBreakdowns(req, res, next) {
  try {
    const data = await dashboardService.getBreakdowns(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPending(req, res, next) {
  try {
    const data = await dashboardService.getPending(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getRecent(req, res, next) {
  try {
    const data = await dashboardService.getRecent(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getQueue(req, res, next) {
  try {
    const data = await dashboardService.getQueue(req.user);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

