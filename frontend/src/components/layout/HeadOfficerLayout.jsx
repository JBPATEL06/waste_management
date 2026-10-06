import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function HeadOfficerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/ho/dashboard', icon: 'dashboard' },
    { label: 'Batches', path: '/ho/batches', icon: 'inventory_2' },
    { label: 'Export', path: '/ho/export', icon: 'download' },
    { label: 'Audit Log', path: '/ho/audit', icon: 'history' }
  ];

  return (
    <div className="bg-background font-body text-text min-h-screen antialiased">
      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-50">
        <div className="h-14 w-full px-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-space-sm">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <Link to="/" className="flex items-center gap-2 sm:gap-space-sm hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-primary-container text-[22px] sm:text-[24px]">eco</span>
              <span className="font-section-title text-[15px] sm:text-section-title tracking-tight text-text truncate max-w-[140px] sm:max-w-none">
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
                <span className="font-label text-label text-text">{user?.name || 'Manoj Kumar'}</span>
              </div>
            </Link>
            <span className="font-badge text-[11px] sm:text-badge px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-border">
              Head Officer
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

      {/* Fixed Sidebar */}
      <aside
        className={`fixed left-0 top-14 bottom-0 w-[240px] bg-surface border-r border-border z-40 flex flex-col justify-between py-space-lg px-space-md transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0 shadow-none'
        }`}
      >
        <div className="flex flex-col gap-space-xs">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-space-md px-3 h-10 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-soft text-badge-completed-text font-medium'
                      : 'font-body-medium text-body-medium text-text-muted hover:bg-background hover:text-text'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}

            <div className="my-2 border-t border-border"></div>

            <NavLink
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-space-md px-3 h-10 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-soft text-badge-completed-text font-medium'
                    : 'font-body-medium text-body-medium text-text-muted hover:bg-background hover:text-text'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
              <span>Profile</span>
            </NavLink>

            <button
              onClick={handleLogout}
              className="flex items-center gap-space-md px-3 h-10 rounded-lg font-body-medium text-body-medium text-text-muted hover:bg-background hover:text-error transition-colors text-left w-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span>Logout</span>
            </button>
          </nav>
        </div>

        {/* Head Officer Status Chip */}
        <div className="p-3 rounded-lg border border-border bg-background flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label text-label text-text font-medium">Head Officer</span>
            <span className="font-caption text-caption text-text-muted">Analytical Access</span>
          </div>
          <span className="font-badge text-badge px-2 py-0.5 rounded-full bg-badge-completed-bg text-badge-completed-text">
            Active
          </span>
        </div>
      </aside>

      {/* Main Content View */}
      <div className="pl-0 lg:pl-[240px] transition-[padding] duration-200">
        <main className="w-full pt-20 pb-12 px-4 sm:px-6 lg:px-margin bg-background min-h-screen">
          <div className="flex flex-col w-full max-w-[1440px] mx-auto pb-space-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

