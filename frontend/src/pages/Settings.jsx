import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settingsApi';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isHeadOfficer = user?.role === 'HEAD_OFFICER';

  const [varianceThreshold, setVarianceThreshold] = useState(10);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => settingsApi.getSettings(),
  });

  useEffect(() => {
    if (settingsData?.settings?.variance_threshold_pct !== undefined) {
      setVarianceThreshold(settingsData.settings.variance_threshold_pct);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (newThreshold) =>
      settingsApi.updateSettings({ variance_threshold_pct: parseFloat(newThreshold) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setToastMessage(`Settings updated successfully: Threshold set to ${res.settings?.variance_threshold_pct}%`);
      setToastVisible(true);
      setErrorMessage('');
      setTimeout(() => setToastVisible(false), 4000);
    },
    onError: (err) => {
      setErrorMessage(err.message || 'Failed to update settings');
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (isHeadOfficer) return;
    updateMutation.mutate(varianceThreshold);
  };

  const handleReset = () => {
    setVarianceThreshold(10);
  };

  const numVal = parseFloat(varianceThreshold) || 10;
  const thresholdKg = ((2500 * numVal) / 100).toFixed(1).replace(/\.0$/, '');

  const lastUpdatedText = settingsData?.settings?.updated_at
    ? new Date(settingsData.settings.updated_at).toLocaleString()
    : 'System Initial Default';

  return (
    <div className="max-w-[808px] w-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-page-title text-page-title text-text">Settings</h1>
        <p className="font-body text-body text-text-muted">
          Configure global system thresholds and validation parameters.
        </p>
      </div>

      {/* Feedback Notification */}
      {toastVisible && (
        <div className="flex items-center justify-between bg-primary-soft border border-primary text-badge-completed-text px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span className="font-label text-label font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastVisible(false)}
            className="text-badge-completed-text hover:opacity-75 flex items-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-surface rounded-xl border border-border p-[20px] flex flex-col gap-6 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <h2 className="font-section-title text-section-title text-text">Operational Thresholds</h2>
          <p className="font-body text-body text-text-muted">
            Thresholds governing automated variance detection and chain-of-custody alerts across transit checkpoints.
          </p>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSave}>
          {/* Field: Variance Threshold */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-label text-label text-text flex items-center gap-1" htmlFor="varianceThreshold">
                Variance Threshold (%) <span aria-hidden="true" className="text-error">*</span>
              </label>
              <span className="font-caption text-caption text-text-muted">Default: 10%</span>
            </div>

            <div className="relative w-full max-w-[240px]">
              <input
                id="varianceThreshold"
                name="varianceThreshold"
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                required
                disabled={isHeadOfficer || isLoading}
                value={varianceThreshold}
                onChange={(e) => setVarianceThreshold(e.target.value)}
                className="w-full h-10 px-3 pr-9 bg-surface rounded-lg border border-border text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:bg-background disabled:cursor-not-allowed"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted font-body-medium text-body-medium">
                %
              </div>
            </div>

            <p className="font-caption text-caption text-text-muted mt-0.5">
              Permissible weight variance percentage between collection net weight and RTS arrival weight before an automated discrepancy flag is triggered.
            </p>

            <div className="flex items-start gap-1.5 mt-1 text-text-muted font-caption text-caption bg-background p-2.5 rounded-lg border border-border/60">
              <span className="material-symbols-outlined text-[16px] text-text-muted mt-0.5">info</span>
              <span>
                <strong className="font-medium text-text">Rule:</strong> Applies to new RTS entries. Existing flagged entries and historical logs remain unchanged.
              </span>
            </div>
          </div>

          {/* Formula Evaluation Logic & Preview */}
          <div className="bg-background rounded-lg border border-border p-3.5 flex flex-col gap-2">
            <span className="font-caption text-caption text-text font-semibold uppercase tracking-wider">
              Evaluation Logic & Preview
            </span>
            <div className="font-batch-id text-[12px] leading-5 text-text-muted bg-surface px-2.5 py-1.5 rounded border border-border inline-block overflow-x-auto">
              | (Net Weight RTS - Net Weight Collection) / Net Weight Collection | × 100 &gt; <span className="text-text font-semibold">{numVal}</span>%
            </div>
            <p className="font-caption text-caption text-text-muted">
              For a 2,500 kg collection batch, a weight loss exceeding {thresholdKg} kg ({numVal.toFixed(1)}%) will automatically flag the batch for supervisor review and require mandatory entry justification.
            </p>
          </div>

          {/* Actions */}
          {!isHeadOfficer && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={handleReset}
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto justify-center h-10 px-4 bg-surface text-text hover:bg-background border border-border rounded-lg font-body-medium text-body-medium transition-colors flex items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-text-muted">restart_alt</span>
                <span>Reset to Default</span>
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto justify-center h-10 px-5 bg-primary text-on-primary hover:bg-primary-hover rounded-lg font-body-medium text-body-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-70"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {updateMutation.isPending ? 'progress_activity' : 'save'}
                </span>
                <span>{updateMutation.isPending ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* System Configuration Metadata Card */}
      <div className="bg-surface rounded-xl border border-border p-[20px] flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-section-title text-section-title text-text">Configuration Information</h3>
          <span className="font-badge text-badge bg-badge-created-bg text-badge-created-text px-2 py-0.5 rounded-full border border-border">
            System Controlled
          </span>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="flex flex-col gap-0.5">
            <dt className="font-label text-label text-text-muted">API Scope</dt>
            <dd className="font-body-medium text-body-medium text-text">Production / Local Supabase</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-label text-label text-text-muted">Configuration Scope</dt>
            <dd className="font-body-medium text-body-medium text-text">Global (All active routes & RTS facilities)</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-label text-label text-text-muted">Last Modified</dt>
            <dd className="font-body-medium text-body-medium text-text">{lastUpdatedText}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-label text-label text-text-muted">Audit Reference</dt>
            <dd className="font-body-medium text-body-medium text-text flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-text-muted">receipt_long</span>
              <Link to="/admin/audit" className="text-primary hover:underline">
                Audit Trail
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
