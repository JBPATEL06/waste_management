import { query } from '../db/index.js';
import { logAudit } from './auditService.js';

export async function getSettings() {
  const result = await query(`SELECT key, value, updated_at, updated_by FROM app_settings`);
  const settings = {};
  for (const row of result.rows) {
    if (row.key === 'variance_threshold_pct') {
      settings[row.key] = Number(row.value);
    } else {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

export async function updateSettings({ variance_threshold_pct, adminId }) {
  const currentSettings = await getSettings();

  await query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES ('variance_threshold_pct', $1, $2, now())
     ON CONFLICT (key) DO UPDATE 
     SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [variance_threshold_pct.toString(), adminId]
  );

  await logAudit({
    action: 'MASTER_CHANGE',
    entityType: 'app_settings',
    entityId: null,
    oldValues: currentSettings,
    newValues: { variance_threshold_pct },
    reason: 'Updated system variance threshold',
    performedBy: adminId,
  });

  return getSettings();
}

