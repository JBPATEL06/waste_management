import * as auditLogService from '../services/auditLogService.js';

export async function listAuditLogs(req, res, next) {
  try {
    if ((req.query.format || '').toLowerCase() === 'csv') {
      const { entries } = await auditLogService.listAuditLogs({ ...req.query, limit: 10000, offset: 0, page: undefined });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_ledger_${Date.now()}.csv"`);

      const rows = entries.map((r) =>
        `"${r.performed_at}","${r.action}","${r.user_name || 'System'}","${r.batch_code || '—'}","${r.entity_type || ''}","${r.reason || ''}"`
      );
      const csvContent = `"Time","Action","User","Batch Code","Entity","Reason"\n` + rows.join('\n');
      return res.status(200).send(csvContent);
    }
    const data = await auditLogService.listAuditLogs(req.query);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

