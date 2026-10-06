import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
            progress_activity
          </span>
          <span className="text-sm font-medium">Authenticating session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force users requiring password reset to /change-password
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // If already changed password, don't trap them on /change-password
  if (!user.must_change_password && location.pathname === '/change-password') {
    const roleRoutes = {
      ADMIN: '/admin/dashboard',
      HEAD_OFFICER: '/ho/dashboard',
      COLLECTION: '/collection/dashboard',
      TRANSPORTATION: '/transportation/dashboard',
      RTS: '/rts/dashboard',
      PROCESSING: '/processing/dashboard',
    };
    return <Navigate to={roleRoutes[user.role] || '/profile'} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}

