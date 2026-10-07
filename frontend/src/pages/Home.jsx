import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/common/BrandLogo';

export default function Home() {
  const [batchCode, setBatchCode] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleTrack = (e) => {
    e.preventDefault();
    const query = batchCode.trim().toUpperCase();
    if (!query) return;
    navigate(`/track/${encodeURIComponent(query)}`);
  };

  const sampleBatches = [
    { code: 'WB-2026-0012', label: 'Stage: Created' },
    { code: 'WB-2026-0013', label: 'Stage: Collected' },
    { code: 'WB-2026-0014', label: 'Stage: In Transit' },
    { code: 'WB-2026-0015', label: 'Stage: Completed (Flagged RTS)' },
  ];

  return (
    <div className="min-h-screen bg-background font-body text-text flex flex-col selection:bg-primary-soft selection:text-primary">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <BrandLogo />
            <div>
              <span className="font-heading font-bold text-text text-lg tracking-tight block leading-tight">
                WasteFlow
              </span>
              <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">
                Municipal Custody Portal
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {user ? (
              <Link
                to={
                  user.role === 'ADMIN'
                    ? '/admin/dashboard'
                    : user.role === 'HEAD_OFFICER'
                    ? '/ho/dashboard'
                    : `/${user.role.toLowerCase()}/dashboard`
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary-hover shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">dashboard</span>
                <span>Dashboard ({user.role})</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/track"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-text-muted hover:text-text text-sm font-medium rounded-lg hover:bg-surface-active transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">search</span>
                  <span>Track Batch</span>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary-hover shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>Staff Login</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section with Interactive Public Search */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold uppercase tracking-wider mb-6 border border-primary/20">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Live Solid Waste Custody Tracking
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-text tracking-tight max-w-3xl mx-auto leading-tight sm:leading-none">
          Verify Every Stage of Municipal Waste Journey
        </h1>

        <p className="mt-4 sm:mt-6 text-base sm:text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
          From neighborhood bin collection to transit, transfer station custody check, and final facility processing—tracked with tamper-evident audit trails.
        </p>

        {/* Tracking Search Card */}
        <div className="mt-8 sm:mt-10 max-w-xl mx-auto bg-surface rounded-2xl border border-border p-4 sm:p-6 shadow-md text-left">
          <label htmlFor="homeBatchCode" className="block text-xs font-semibold text-text uppercase tracking-wider mb-2">
            Track a Batch by Passport Code
          </label>
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled material-symbols-outlined text-[20px]">
                qr_code_2
              </span>
              <input
                id="homeBatchCode"
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="e.g. WB-2026-0012"
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-background text-text font-mono font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition uppercase placeholder:font-body placeholder:normal-case placeholder:text-text-disabled"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-5 bg-primary hover:bg-primary-hover active:bg-primary-hover text-on-primary font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
              <span>Track Journey</span>
            </button>
          </form>

          {/* Quick Demo Batch Chips */}
          <div className="mt-4 pt-3 border-t border-border">
            <span className="text-xs text-text-muted block mb-2 font-medium">
              Demo sample batches (click to test):
            </span>
            <div className="flex flex-wrap gap-2">
              {sampleBatches.map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => navigate(`/track/${b.code}`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background hover:bg-surface-active border border-border text-xs text-text font-mono transition-colors group cursor-pointer"
                >
                  <span className="font-semibold text-primary">{b.code}</span>
                  <span className="text-text-muted text-[11px] font-sans">({b.label})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4-Stage Custody Pipeline Overview */}
      <section className="bg-surface border-y border-border py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-text tracking-tight">
              4-Stage Custody Architecture
            </h2>
            <p className="text-sm text-text-muted mt-1.5">
              Strict role-based segregation ensuring authentic data at every hand-off point.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stage 1 */}
            <div className="p-5 rounded-xl border border-border bg-background flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[22px]">delete</span>
              </div>
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Stage 1</span>
              <h3 className="font-semibold text-text text-base mt-1">Collection</h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Collection officers verify source ward, waste category (wet, dry, domestic hazardous), and gross initial load.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="p-5 rounded-xl border border-border bg-background flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[22px]">local_shipping</span>
              </div>
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Stage 2</span>
              <h3 className="font-semibold text-text text-base mt-1">Transportation</h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Designated vehicle drivers log transit departure, weighbridge tare/gross mass, and destination transfer route.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="p-5 rounded-xl border border-border bg-background flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
              </div>
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Stage 3</span>
              <h3 className="font-semibold text-text text-base mt-1">RTS Weighmaster</h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Refuse Transfer Station officers verify incoming mass against transit logs with automated ±10% discrepancy flagging.
              </p>
            </div>

            {/* Stage 4 */}
            <div className="p-5 rounded-xl border border-border bg-background flex flex-col">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[22px]">factory</span>
              </div>
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Stage 4</span>
              <h3 className="font-semibold text-text text-base mt-1">Processing Facility</h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Intake at composting, MRF recycling, or waste-to-energy plants completes the batch lifecycle with final disposal sign-off.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Staff Action Banner */}
      <section className="py-12 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <div className="bg-primary-soft/40 border border-primary/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
          <div>
            <h3 className="text-lg font-bold text-text">Municipal Officers & Field Staff</h3>
            <p className="text-sm text-text-muted mt-1 max-w-lg">
              Log in to access your assigned batch queue, enter weighbridge records, and review compliance dashboards.
            </p>
          </div>
          <Link
            to="/login"
            className="h-11 px-6 bg-primary hover:bg-primary-hover text-on-primary font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            <span>Go to Staff Login</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-surface py-6 px-4 sm:px-6 text-center text-xs text-text-muted">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Municipal Solid Waste Custody Tracking System. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/track" className="hover:text-primary transition-colors">
              Public Search
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-primary transition-colors">
              Staff Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
