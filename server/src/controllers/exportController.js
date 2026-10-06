import * as exportService from '../services/exportService.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

export async function exportDataset(req, res, next) {
  try {
    const { dataset } = req.params;
    const format = (req.query.format || 'csv').toLowerCase();

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

