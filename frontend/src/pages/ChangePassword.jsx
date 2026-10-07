import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { LoadingButton } from '../components/LoadingButton';
import BrandLogo from '../components/common/BrandLogo';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const getRoleRedirect = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    if (user.role === 'HEAD_OFFICER') return '/ho/dashboard';
    if (user.role === 'COLLECTION') return '/collection/dashboard';
    if (user.role === 'TRANSPORTATION') return '/transportation/dashboard';
    if (user.role === 'RTS') return '/rts/dashboard';
    if (user.role === 'PROCESSING') return '/processing/dashboard';
    return '/profile';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('New password must be at least 8 characters and include at least one letter and one number.');
      return;
    }

    if (newPassword === currentPassword) {
      toast.warning('New password cannot match your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully! Redirecting...');
      setTimeout(() => {
        navigate(getRoleRedirect(), { replace: true });
      }, 1000);
    } catch (err) {
      let errMsg = err.message || 'Failed to update password.';
      if ((err.status === 422 || err.code === 'VALIDATION_FAILED') && err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        errMsg = Object.entries(err.fieldErrors)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }
      toast.error(errMsg);
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background font-body text-text min-h-screen flex items-center justify-center p-gutter-mobile sm:p-gutter">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="flex flex-col w-full">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <span className="font-section-title text-section-title text-text tracking-tight font-semibold">
                Waste Journey Tracker
              </span>
            </div>
          </div>

          {/* Form Card */}
          <div className="w-full bg-surface border border-border rounded-xl p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="font-page-title text-page-title text-text">Change Password</h1>
              <p className="font-label text-label text-text-muted mt-1">
                Please choose a new password to secure your account.
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              {/* Current Password */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="currentPassword">
                  Current password
                </label>
                <div className="relative w-full">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 bg-surface border border-border rounded-lg font-body text-body text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    aria-label="Toggle current password visibility"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-text-muted hover:text-text focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showCurrent ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="newPassword">
                  New password
                </label>
                <div className="relative w-full">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 bg-surface border border-border rounded-lg font-body text-body text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    aria-label="Toggle new password visibility"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-text-muted hover:text-text focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showNew ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="font-caption text-caption text-text-muted mt-0.5 leading-tight">
                  Minimum 8 characters, at least one letter and one number. Cannot match current password.
                </p>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <div className="relative w-full">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 bg-surface border border-border rounded-lg font-body text-body text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    aria-label="Toggle confirm password visibility"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-text-muted hover:text-text focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <LoadingButton
                  type="submit"
                  loading={submitting}
                  loadingText="Updating Password..."
                  className="w-full h-10 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer disabled:opacity-75"
                >
                  Update Password
                </LoadingButton>
                <Link
                  to={getRoleRedirect()}
                  className="text-center text-xs text-text-muted hover:text-text py-1"
                >
                  Cancel and go back
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}