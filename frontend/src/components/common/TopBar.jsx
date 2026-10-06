import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function TopBar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  const getDashboardPath = (role) => {
    switch (role) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'HEAD_OFFICER':
        return '/ho/dashboard';
      case 'COLLECTION':
        return '/collection/dashboard';
      case 'TRANSPORTATION':
        return '/transportation/dashboard';
      case 'RTS':
        return '/rts/dashboard';
      case 'PROCESSING':
        return '/processing/dashboard';
      default:
        return '/';
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="text-xs font-semibold bg-primary-soft text-primary px-2.5 py-0.5 rounded-full">Admin</span>;
      case 'COLLECTION':
        return <span className="text-xs font-semibold bg-badge-collected-bg text-badge-collected-text px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">Collection</span>;
      case 'TRANSPORTATION':
        return <span className="text-xs font-semibold bg-badge-transit-bg text-badge-transit-text px-2.5 py-0.5 rounded-full border border-[#FDE68A]">Transportation</span>;
      case 'RTS':
        return <span className="text-xs font-semibold bg-badge-rts-bg text-badge-rts-text px-2.5 py-0.5 rounded-full border border-[#E9D5FF]">RTS</span>;
      case 'PROCESSING':
        return <span className="text-xs font-semibold bg-badge-completed-bg text-badge-completed-text px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">Processing</span>;
      case 'HEAD_OFFICER':
        return <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-border">Head Officer</span>;
      default:
        return <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">{role}</span>;
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-50 flex items-center justify-between px-3 sm:px-6">
      {/* Left: Mobile Toggle + Logo */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[20px]">recycling</span>
          </div>
          <span className="font-semibold text-[15px] sm:text-[17px] text-text tracking-tight truncate max-w-[150px] sm:max-w-none">
            Waste Journey Tracker
          </span>
        </Link>
      </div>

      {/* Right Side */}
      {user ? (
        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text hidden md:inline">{user.name}</span>
            {getRoleBadge(user.role)}
          </div>
          <div className="h-4 w-[1px] bg-border hidden sm:block"></div>
          {location.pathname === '/profile' ? (
            <Link
              to={getDashboardPath(user.role)}
              className="text-xs sm:text-sm font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1 bg-primary-soft px-2.5 py-1 rounded-lg border border-primary/20 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Link>
          ) : (
            <Link
              to="/profile"
              className="text-sm font-medium text-text-muted hover:text-text transition-colors hidden sm:inline"
            >
              Profile
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-text-muted hover:text-error transition-colors flex items-center gap-1 p-1 sm:p-0 cursor-pointer"
            title="Logout"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[18px]">logout</span>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Link
            to="/track"
            className="text-sm font-medium text-text-muted hover:text-text transition-colors"
          >
            Track Batch
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium bg-primary text-white hover:bg-primary-hover px-3.5 py-1.5 rounded-lg transition-colors"
          >
            Login
          </Link>
        </div>
      )}
    </header>
  );
}

