import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AccessDenied403() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="bg-background font-body text-text min-h-screen flex items-center justify-center p-gutter-mobile sm:p-gutter">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="flex flex-col w-full items-center">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[20px]">recycling</span>
            </div>
            <span className="font-section-title text-section-title text-text tracking-tight font-semibold">
              Waste Journey Tracker
            </span>
          </div>

          {/* 403 Card */}
          <div className="w-full bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col">
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-soft text-error border border-error/20">
                <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                403 Forbidden
              </span>
            </div>

            <h1 className="font-page-title text-page-title text-text">Access Denied</h1>
            <p className="font-body text-body text-text-muted mt-2 mb-6">
              You do not have permission to access this page or resource. Please check your credentials or return to your dashboard.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => navigate(user ? (user.role === 'ADMIN' ? '/admin/dashboard' : '/profile') : '/login')}
                className="w-full h-10 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer"
              >
                Go to Login / Dashboard
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-text font-body-medium text-body-medium rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                Return to Previous Page
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
