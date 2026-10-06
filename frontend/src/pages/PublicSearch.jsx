import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function PublicSearch() {
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const query = batchId.trim().toUpperCase();
    if (!query) return;

    // Direct navigation to tracking page
    navigate(`/track/${query}`);
  };

  return (
    <div className="bg-background font-body text-text min-h-screen flex items-center justify-center p-gutter-mobile sm:p-gutter">
      <main className="w-full max-w-[400px] flex flex-col items-center">
        <div className="flex flex-col w-full items-center">
          {/* Logo */}
          <div className="flex items-center gap-space-sm mb-space-xl">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[20px]">recycling</span>
            </div>
            <span className="font-section-title text-section-title text-text tracking-tight font-semibold">
              Waste Journey Tracker
            </span>
          </div>

          {/* Search Card */}
          <div className="w-full bg-surface rounded-xl border border-border p-[20px] shadow-sm flex flex-col">
            <h1 className="font-page-title text-page-title text-text">Track Waste Batch</h1>
            <p className="font-label text-label text-text-muted mt-space-xs leading-normal">
              Enter a batch code to view its real-time journey and processing timeline.
            </p>

            <form className="mt-space-xl flex flex-col" onSubmit={handleSearch}>
              <div className="flex flex-col gap-space-xs">
                <label className="font-label text-label text-text-muted" htmlFor="batchId">
                  Batch ID
                </label>
                <div className="relative w-full">
                  <input
                    id="batchId"
                    name="batchId"
                    type="text"
                    spellCheck="false"
                    autoComplete="off"
                    placeholder="e.g. WB-2026-0001"
                    value={batchId}
                    onChange={(e) => {
                      setBatchId(e.target.value);
                      setError(false);
                    }}
                    className="w-full h-[40px] px-space-md bg-surface text-text font-batch-id text-batch-id placeholder:text-text-disabled placeholder:font-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all uppercase"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="submit-btn"
                className="mt-space-lg w-full h-[40px] bg-primary text-on-primary font-body-medium text-body-medium rounded-lg hover:bg-primary-hover active:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors flex items-center justify-center gap-space-xs cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                <span>Search Batch</span>
              </button>

              {error && (
                <div className="mt-space-md p-space-sm rounded-lg bg-error-soft text-error flex items-start gap-space-xs border border-error/20" role="alert">
                  <span className="material-symbols-outlined text-[18px] shrink-0 mt-[1px]">error</span>
                  <span className="font-caption text-caption font-medium">
                    Batch ID not found. Please verify the code and try again.
                  </span>
                </div>
              )}
            </form>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-end text-xs text-text-muted">
              <Link to="/login" className="hover:text-primary transition-colors">
                Staff Login →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
