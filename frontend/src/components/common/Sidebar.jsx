import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const isHeadOfficer = user?.role === 'HEAD_OFFICER';

  const adminNavItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Batches', path: '/admin/batches', icon: 'inventory_2' },
    { label: 'Create Batch', path: '/admin/batches/new', icon: 'add_circle' },
    { label: 'Master Data', path: '/admin/master', icon: 'database' },
    { label: 'Users', path: '/admin/users', icon: 'group' },
    { label: 'Export', path: '/admin/export', icon: 'download' },
    { label: 'Audit Log', path: '/admin/audit', icon: 'description' },
    { label: 'Settings', path: '/admin/settings', icon: 'settings' }
  ];

  const hoNavItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Batches', path: '/admin/batches', icon: 'inventory_2' },
    { label: 'Export', path: '/admin/export', icon: 'download' },
    { label: 'Audit Log', path: '/admin/audit', icon: 'description' }
  ];

  const navItems = isHeadOfficer ? hoNavItems : adminNavItems;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 top-14 bg-black/40 z-30 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-14 bottom-0 w-[240px] bg-surface border-r border-border z-40 overflow-y-auto transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0 shadow-none'
        }`}
      >
        <div className="p-3">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin/batches'}
                onClick={() => onClose && onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-soft text-primary font-semibold'
                      : 'text-text-muted hover:bg-slate-100 hover:text-text'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

