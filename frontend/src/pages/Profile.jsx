import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { LoadingButton } from '../components/LoadingButton';
import TopBar from '../components/common/TopBar';
import { STAGE_CONFIG } from '../constants/stages';
import { dashboardApi } from '../api/dashboardApi';
import { formatApiError } from '../utils/formatApiError';

export default function Profile() {
  const { user, updateProfileName, changePassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Role detection
  const roleLower = (user?.role || 'ADMIN').toLowerCase();
  const cfg = STAGE_CONFIG[roleLower] || STAGE_CONFIG.collection;
  const isStageOperator = ['collection', 'transportation', 'rts', 'processing'].includes(roleLower);

  const getDashboardPath = () => {
    if (isStageOperator) return `${cfg.prefix}/dashboard`;
    if (user?.role === 'HEAD_OFFICER') return '/ho/dashboard';
    if (user?.role === 'ADMIN') return '/admin/dashboard';
    return '/';
  };

  const [fullName, setFullName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Password Modal
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Fetch operator's real queue metrics if stage operator
  const { data: queueData } = useQuery({
    queryKey: ['operatorQueueStats', user?.role],
    queryFn: () => dashboardApi.getQueue(),
    enabled: isStageOperator,
    staleTime: 30 * 1000,
  });

  const readyCount = queueData?.counts?.ready_count ?? 0;
  const submittedCount = queueData?.counts?.submitted_count ?? 0;
  const lockedCount = queueData?.counts?.locked_count ?? 0;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSaving(true);
    setSaveError('');
    try {
      await updateProfileName(fullName.trim());
      setSaveSuccess(true);
      toast.success('Profile updated successfully.');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const message = formatApiError(err, 'Failed to update profile name');
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdError('');

    if (!newPwd || newPwd.length < 8 || !/[A-Za-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      setPwdError('Password must be at least 8 characters and include at least one letter and one number.');
      return;
    }
    if (newPwd === currentPwd) {
      setPwdError('New password cannot match your current password.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match.');
      return;
    }

    setPwdSaving(true);
    try {
      await changePassword(currentPwd, newPwd);
      setShowPwdModal(false);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      toast.success('Password updated successfully.');
    } catch (err) {
      const fields = Object.entries(err.fieldErrors || {}).slice(0, 3);
      const message = fields.length
        ? fields.map(([field, detail]) => `${field}: ${detail}`).join('\n')
        : err.message || 'Failed to update password';
      setPwdError(message);
      toast.error(message);
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="bg-background font-body text-text min-h-screen">
      <TopBar />

      <main className="relative pt-20 pb-16 min-h-screen bg-background px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full">
          <div className="max-w-[1080px] w-full mx-auto space-y-space-xl">
            {/* Top Header Breadcrumb & Titles */}
            <header className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate(getDashboardPath())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text bg-surface hover:bg-slate-100 active:bg-slate-200 border border-border rounded-lg shadow-2xs transition-colors cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary transition-colors">arrow_back</span>
                  <span>Back to Dashboard</span>
                </button>

                <nav aria-label="Breadcrumb" className="flex items-center gap-2">
                  <Link
                    to={getDashboardPath()}
                    className="font-caption text-caption text-text-muted hover:text-text transition-colors"
                  >
                    Dashboard
                  </Link>
                  <span className="font-caption text-caption text-text-disabled">/</span>
                  <span className="font-caption text-caption text-text font-body-medium">Profile</span>
                </nav>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-1">
                <div>
                  <h1 className="font-page-title text-page-title text-text tracking-tight">
                    {isStageOperator ? 'Operator Profile' : user?.role === 'HEAD_OFFICER' ? 'Head Officer Profile' : 'Administrator Profile'}
                  </h1>
                  <p className="font-body text-body text-text-muted mt-0.5">
                    Manage account credentials, role details, and security settings
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg shadow-sm self-start md:self-auto">
                  <span className="w-2 h-2 rounded-full bg-badge-completed-text"></span>
                  <span className="font-caption text-caption text-text font-body-medium">
                    Status: Active
                  </span>
                </div>
              </div>
            </header>

            {/* SECTION 1: Stage Workload Summary Card (for operators) */}
            {isStageOperator && (
              <section className="bg-surface rounded-xl border border-border p-[20px] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-space-md border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-badge-completed-text">task_alt</span>
                    <h2 className="font-section-title text-section-title text-text">
                      Active Stage Assignments ({cfg.roleLabel})
                    </h2>
                  </div>
                  <span className="font-badge text-badge px-2.5 py-0.5 rounded-full bg-badge-completed-bg text-badge-completed-text">
                    Active Shift
                  </span>
                </div>

                {/* 3-Column Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg my-space-lg">
                  {/* Ready for Entry Metric Card */}
                  <div className="bg-background rounded-lg border border-border p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-label text-label text-text-muted">Ready for Entry</span>
                      <span className="w-2 h-2 rounded-full bg-badge-transit-text animate-pulse"></span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-kpi-number text-kpi-number text-text">{readyCount}</span>
                      <span className="font-caption text-caption text-text-muted">batches queued</span>
                    </div>
                    <p className="font-caption text-caption text-text-muted mt-2">
                      Awaiting stage processing &amp; entry submission
                    </p>
                  </div>

                  {/* Submitted Metric Card */}
                  <div className="bg-background rounded-lg border border-border p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-label text-label text-text-muted">Submitted</span>
                      <span className="w-2 h-2 rounded-full bg-badge-completed-text"></span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-kpi-number text-kpi-number text-text">{submittedCount}</span>
                      <span className="font-caption text-caption text-badge-completed-text font-body-medium">
                        Logged &amp; Sealed
                      </span>
                    </div>
                    <p className="font-caption text-caption text-text-muted mt-2">
                      Completed stage entries recorded
                    </p>
                  </div>

                  {/* Locked Metric Card */}
                  <div className="bg-background rounded-lg border border-border p-4 flex flex-col justify-between hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-label text-label text-text-muted">Locked</span>
                      <span className="w-2 h-2 rounded-full bg-text-disabled"></span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-kpi-number text-kpi-number text-text-muted">{lockedCount}</span>
                      <span className="font-caption text-caption text-text-muted">pending previous stages</span>
                    </div>
                    <p className="font-caption text-caption text-text-muted mt-2">
                      Waiting for upstream stage completion
                    </p>
                  </div>
                </div>

                <div className="pt-space-sm flex items-center gap-2 text-text-muted">
                  <span className="material-symbols-outlined text-[16px] text-text-disabled">info</span>
                  <p className="font-caption text-caption">
                    Assigned operator: {user?.name} ({user?.email})
                  </p>
                </div>
              </section>
            )}

            {/* SECTION 2: Account Information Card */}
            <section className="bg-surface rounded-xl border border-border p-[20px] shadow-sm">
              <div className="flex items-center justify-between pb-space-md border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-text-muted">person_outline</span>
                  <h2 className="font-section-title text-section-title text-text">Account Information</h2>
                </div>
                <span className="font-caption text-caption text-text-muted">System Synchronized</span>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-space-lg space-y-space-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                  {/* Full Name (Editable) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted flex items-center justify-between" htmlFor="fullName">
                      <span>Full Name <span className="text-error">*</span></span>
                      <span className="font-caption text-caption text-text-disabled">Editable</span>
                    </label>
                    <div className="relative">
                      <input
                        id="fullName"
                        name="fullName"
                        required
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full h-10 px-3 font-body text-body text-text bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>
                    <p className="font-caption text-caption text-text-muted">
                      Your display name across the platform
                    </p>
                  </div>

                  {/* Email Address (Read-only) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label text-label text-text-muted flex items-center justify-between" htmlFor="emailAddress">
                      <span>Email Address</span>
                      <span className="font-caption text-caption text-text-disabled">Read-only</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="emailAddress"
                        readOnly
                        tabIndex={-1}
                        type="email"
                        value={user?.email || ''}
                        className="w-full h-10 px-3 pr-9 font-body text-body text-text-muted bg-background border border-border rounded-lg cursor-not-allowed select-none"
                      />
                      <span className="material-symbols-outlined absolute right-3 text-[18px] text-text-disabled pointer-events-none">
                        lock
                      </span>
                    </div>
                    <p className="font-caption text-caption text-text-muted">
                      Unique account identifier managed by Administrator
                    </p>
                  </div>

                  {/* System Role (Read-only Badge Display) */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-label text-label text-text-muted flex items-center justify-between">
                      <span>Assigned Role</span>
                      <span className="font-caption text-caption text-text-disabled">Read-only</span>
                    </label>
                    <div className="w-full h-10 px-3 bg-background border border-border rounded-lg flex items-center justify-between select-none">
                      <span className={`font-badge text-badge px-2.5 py-0.5 rounded-full ${cfg.badgeClass}`}>
                        {user?.role}
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-text-disabled">badge</span>
                    </div>
                    <p className="font-caption text-caption text-text-muted">
                      Determines operational access permissions
                    </p>
                  </div>
                </div>

                {saveError && (
                  <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                    {saveError}
                  </div>
                )}

                {/* Last Login & Save Changes Row */}
                <div className="pt-space-md border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-text-disabled">schedule</span>
                    <p className="font-caption text-caption text-text-muted">
                      Last Login:{' '}
                      <span className="font-body-medium text-text">
                        {user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Current Session'}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {saveSuccess && (
                      <span className="font-caption text-caption text-badge-completed-text animate-fade-in">
                        Profile updated successfully
                      </span>
                    )}
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      loadingText="Saving..."
                      disabled={saving}
                      className="h-10 px-5 bg-primary hover:bg-primary-hover text-on-primary rounded-lg font-body-medium text-body-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center justify-center gap-2 self-end sm:self-auto cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Save Changes</span>
                    </LoadingButton>
                  </div>
                </div>
              </form>
            </section>

            {/* SECTION 3: Security & Session Management Card */}
            <section className="bg-surface rounded-xl border border-border p-[20px] shadow-sm mb-space-2xl">
              <div className="flex items-center gap-2 pb-space-md border-b border-border">
                <span className="material-symbols-outlined text-[20px] text-text-muted">security</span>
                <h2 className="font-section-title text-section-title text-text">Security &amp; Access</h2>
              </div>

              <div className="divide-y divide-border">
                {/* Row 1: Password Management */}
                <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2">
                      <h3 className="font-body-medium text-body-medium text-text">Password</h3>
                    </div>
                    <p className="font-caption text-caption text-text-muted mt-1 leading-normal">
                      Ensure your password contains at least 8 characters including mixed uppercase letters, numerals, and symbols.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPwdModal(true)}
                      className="h-10 px-4 bg-surface hover:bg-background border border-border text-text font-body-medium text-body-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px] text-text-muted">key</span>
                      <span>Change Password</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Change Password Modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 bg-text/40 flex items-center justify-center p-4 backdrop-blur-[1px]">
          <div className="bg-surface rounded-xl border border-border max-w-md w-full p-[20px] shadow-lg animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-section-title text-section-title text-text">Change Account Password</h3>
              <button
                type="button"
                disabled={pwdSaving}
                onClick={() => {
                  setShowPwdModal(false);
                  setPwdError('');
                }}
                className="text-text-muted hover:text-text cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {pwdError && (
              <div className="mt-3 p-2.5 rounded-lg bg-error-soft text-error text-caption font-caption">
                {pwdError}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-3 mt-4">
              <div>
                <label className="font-label text-label text-text-muted block mb-1">Current Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••••••"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-label text-label text-text-muted block mb-1">New Password</label>
                <input
                  required
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-label text-label text-text-muted block mb-1">Confirm New Password</label>
                <input
                  required
                  type="password"
                  placeholder="Re-type new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={pwdSaving}
                  onClick={() => setShowPwdModal(false)}
                  className="h-10 px-4 border border-border rounded-lg text-body-medium text-text bg-surface hover:bg-background cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={pwdSaving}
                  loadingText="Updating..."
                  className="h-10 px-4 bg-primary hover:bg-primary-hover text-on-primary rounded-lg text-body-medium cursor-pointer"
                >
                  Update Password
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
