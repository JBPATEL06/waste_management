import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { STAGE_CONFIG } from '../../constants/stages';

export default function StageLayout({ currentRole }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine stage role from prop or URL
  let roleKey = currentRole;
  if (!roleKey) {
    if (location.pathname.startsWith('/transportation')) roleKey = 'transportation';
    else if (location.pathname.startsWith('/rts')) roleKey = 'rts';
    else if (location.pathname.startsWith('/processing')) roleKey = 'processing';
    else roleKey = 'collection';
  }

  const cfg = STAGE_CONFIG[roleKey] || STAGE_CONFIG.collection;

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="bg-background font-body text-text antialiased min-h-screen">
      {/* Top Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-surface z-40 border-b border-border">
        <div className="h-14 w-full px-3 sm:px-space-xl flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-space-md">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle stage menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-space-md hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-primary-container text-[22px] sm:text-[24px]">eco</span>
              <span className="font-page-title text-[15px] sm:text-section-title tracking-tight text-text truncate max-w-[140px] sm:max-w-none">
                Waste Journey Tracker
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-space-lg">
            <Link to="/profile" className="flex items-center gap-1.5 sm:gap-space-sm hover:opacity-85 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer text-white">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-label text-label text-text">{user?.name || 'Operator'}</span>
              </div>
            </Link>
            <span className={`font-badge text-[11px] sm:text-badge px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
              {cfg.roleLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-14 bg-black/40 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Stage Sidebar */}
      <aside
        className={`fixed left-0 top-14 h-[calc(100vh-3.5rem)] w-60 bg-surface z-40 border-r border-border flex flex-col justify-between p-space-lg transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0 shadow-none'
        }`}
      >
        <nav className="flex flex-col gap-space-xs">
          <NavLink
            to={`${cfg.prefix}/dashboard`}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary-soft text-primary-container font-body-medium'
                  : 'text-text-muted hover:bg-background hover:text-text'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">grid_view</span>
            <span className="font-body text-body whitespace-nowrap">Dashboard</span>
          </NavLink>
          <NavLink
            to={`${cfg.prefix}/history`}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary-soft text-primary-container font-body-medium'
                  : 'text-text-muted hover:bg-background hover:text-text'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            <span className="font-body text-body whitespace-nowrap">History</span>
          </NavLink>
          <div className="my-space-xs border-t border-border"></div>
          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-space-md px-space-md py-space-sm rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary-soft text-primary-container font-body-medium'
                  : 'text-text-muted hover:bg-background hover:text-text'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
            <span className="font-body text-body whitespace-nowrap">Profile</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-space-md px-space-md py-space-sm rounded-lg text-text-muted hover:bg-background hover:text-error transition-all whitespace-nowrap cursor-pointer text-left w-full"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="font-body text-body whitespace-nowrap">Logout</span>
          </button>
        </nav>

        <div className="flex flex-col gap-2">
          <div className="px-space-md py-space-sm rounded-lg bg-background border border-border">
            <p className="font-caption text-caption text-text-muted">Active Role</p>
            <p className="font-label text-label text-text truncate">
              {cfg.roleLabel} Operational Node
            </p>
          </div>
          <div className="px-space-md py-space-xs text-text-disabled font-caption text-caption">
            User ID: {user?.id?.slice(0, 8) || 'Authenticated'}
          </div>
        </div>
      </aside>

      {/* Main Outlet Area */}
      <div className="pl-0 lg:pl-60 transition-[padding] duration-200">
        <main className="relative pt-14 min-h-screen bg-background p-4 sm:p-6 lg:p-space-xl">
          <div className="flex flex-col w-full max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
