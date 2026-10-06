import * as settingsService from '../services/settingsService.js';

export async function getSettings(req, res, next) {
  try {
    const settings = await settingsService.getSettings();
    return res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const settings = await settingsService.updateSettings({
      variance_threshold_pct: req.body.variance_threshold_pct,
      adminId: req.user.id,
    });
    return res.status(200).json({
      message: 'Settings updated successfully',
      settings,
    });
  } catch (err) {
    next(err);
  }
}

