import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function NotFound404() {
  const navigate = useNavigate();

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

          {/* 404 Card */}
          <div className="w-full bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-error-soft text-error flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[22px]">search_off</span>
            </div>

            <h1 className="font-page-title text-page-title text-text">Not Found</h1>
            <p className="font-body text-body text-text-muted mt-2 mb-6">
              The requested batch code or route could not be found or does not exist in the system. Please verify and try again.
            </p>

            <button
              onClick={() => navigate('/track')}
              className="w-full h-10 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
              <span>Search Another Batch</span>
            </button>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-text-muted hover:text-text transition-colors"
              >
                Back to Home / Login
              </Link>
            </div>

            <div className="mt-6 pt-3 border-t border-border flex items-center justify-between text-xs text-text-disabled">
              <span>Query Status: Unresolved</span>
              <span className="font-mono">ERR_404</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
