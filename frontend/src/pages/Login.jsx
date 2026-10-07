import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { LoadingButton } from '../components/LoadingButton';
import BrandLogo from '../components/common/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (user.must_change_password) {
        navigate('/change-password', { replace: true });
      } else if (user.role === 'ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'HEAD_OFFICER') {
        navigate('/ho/dashboard', { replace: true });
      } else if (user.role === 'COLLECTION') {
        navigate('/collection/dashboard', { replace: true });
      } else if (user.role === 'TRANSPORTATION') {
        navigate('/transportation/dashboard', { replace: true });
      } else if (user.role === 'RTS') {
        navigate('/rts/dashboard', { replace: true });
      } else if (user.role === 'PROCESSING') {
        navigate('/processing/dashboard', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error('Please fill in both fields.');
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(email.trim(), password);
      toast.success('Signed in successfully.');

      if (loggedUser.must_change_password) {
        navigate('/change-password');
        return;
      }

      if (loggedUser.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (loggedUser.role === 'HEAD_OFFICER') {
        navigate('/ho/dashboard');
      } else if (loggedUser.role === 'COLLECTION') {
        navigate('/collection/dashboard');
      } else if (loggedUser.role === 'TRANSPORTATION') {
        navigate('/transportation/dashboard');
      } else if (loggedUser.role === 'RTS') {
        navigate('/rts/dashboard');
      } else if (loggedUser.role === 'PROCESSING') {
        navigate('/processing/dashboard');
      } else {
        navigate('/profile');
      }
    } catch (err) {
      let errMsg = err.message || 'Invalid email or password. Please verify your credentials.';
      if ((err.status === 422 || err.code === 'VALIDATION_FAILED') && err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        errMsg = Object.entries(err.fieldErrors)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background font-body text-text min-h-screen flex items-center justify-center p-gutter-mobile sm:p-gutter">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="flex flex-col w-full">
          {/* Logo and App Title */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <BrandLogo />
            <span className="font-page-title text-page-title text-text tracking-tight font-semibold">
              Waste Journey Tracker
            </span>
          </div>

          {/* Form Card */}
          <div className="w-full bg-surface border border-border rounded-xl p-[20px] shadow-sm">
            <h1 className="font-page-title text-page-title text-text mb-6">Sign in</h1>

            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-1">
                <label className="block font-label text-label text-text-muted" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[40px] px-3 bg-surface text-text font-body text-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-disabled transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-label text-label text-text-muted" htmlFor="password">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[40px] pl-3 pr-10 bg-surface text-text font-body text-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-text-disabled transition-colors"
                  />
                  <button
                    type="button"
                    id="toggle-password"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-[40px] w-10 flex items-center justify-center text-text-muted hover:text-text focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <LoadingButton
                type="submit"
                id="submit-btn"
                loading={loading}
                loadingText="Signing in..."
                className="w-full h-[40px] bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer disabled:opacity-75"
              >
                Login
              </LoadingButton>
            </form>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
              <Link to="/track" className="hover:text-primary transition-colors">
                Public Batch Tracking
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
