import * as auditLogService from '../services/auditLogService.js';

export async function listAuditLogs(req, res, next) {
  try {
    const data = await auditLogService.listAuditLogs(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

