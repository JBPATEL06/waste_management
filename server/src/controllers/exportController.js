import * as exportService from '../services/exportService.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { auditActionEnum } from '../validators/auditLogValidators.js';

export async function previewDataset(req, res, next) {
  try {
    const data = await exportService.fetchDatasetRows(req.params.dataset, {
      ...req.query,
      limit: 10,
    });
    res.json({
      name: data.name,
      columns: data.columns.map(({ key, header }) => ({ key, header })),
      rows: data.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportDataset(req, res, next) {
  try {
    const { dataset } = req.params;
    const format = (req.query.format || 'csv').toLowerCase();

    if (req.query.action && req.query.action !== 'ALL') {
      auditActionEnum.parse(req.query.action);
    }

    if (format === 'csv') {
      await exportService.exportCsv(dataset, req.query, res);
    } else if (format === 'xlsx') {
      await exportService.exportXlsx(dataset, req.query, res);
    } else {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, "Format must be either 'csv' or 'xlsx'");
    }
  } catch (err) {
    next(err);
  }
}
