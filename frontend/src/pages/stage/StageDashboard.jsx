import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STAGE_CONFIG } from '../../constants/stages';
import { dashboardApi } from '../../api/dashboardApi';
import StatusBadge from '../../components/common/StatusBadge';

import { formatDateTime } from '../../utils/formatDateTime';


export default function StageDashboard({ role: propRole }) {
  const location = useLocation();

  // Resolve role config
  let roleKey = propRole;
  if (!roleKey) {
    if (location.pathname.startsWith('/transportation')) roleKey = 'transportation';
    else if (location.pathname.startsWith('/rts')) roleKey = 'rts';
    else if (location.pathname.startsWith('/processing')) roleKey = 'processing';
    else roleKey = 'collection';
  }

  const cfg = STAGE_CONFIG[roleKey] || STAGE_CONFIG.collection;

  const [activeTab, setActiveTab] = useState('ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch operator queue from real backend
  const { data: queueData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['stageQueue', roleKey],
    queryFn: () => dashboardApi.getQueue(),
  });

  const counts = queueData?.counts || {
    ready_count: 0,
    locked_count: 0,
    submitted_count: 0,
  };

  const readyBatches = queueData?.ready || [];
  const lockedBatches = queueData?.locked || [];
  const submittedBatches = queueData?.submitted || [];

  // Filtered Ready
  const filteredReady = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return readyBatches;
    return readyBatches.filter(
      (b) =>
        (b.batch_code || '').toLowerCase().includes(q) ||
        (b.source_area || '').toLowerCase().includes(q) ||
        (b.route_name || '').toLowerCase().includes(q)
    );
  }, [readyBatches, searchQuery]);

  // Filtered Locked
  const filteredLocked = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return lockedBatches;
    return lockedBatches.filter(
      (b) =>
        (b.batch_code || '').toLowerCase().includes(q) ||
        (b.source_area || '').toLowerCase().includes(q) ||
        (b.route_name || '').toLowerCase().includes(q) ||
        (b.lock_reason || '').toLowerCase().includes(q)
    );
  }, [lockedBatches, searchQuery]);

  // Filtered Submitted
  const filteredSubmitted = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return submittedBatches;
    return submittedBatches.filter(
      (b) =>
        (b.batch_code || '').toLowerCase().includes(q) ||
        (b.source_area || '').toLowerCase().includes(q) ||
        (b.route_name || '').toLowerCase().includes(q)
    );
  }, [submittedBatches, searchQuery]);

  // Pagination for Ready
  const totalPagesReady = Math.max(1, Math.ceil(filteredReady.length / rowsPerPage));
  const paginatedReady = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredReady.slice(start, start + rowsPerPage);
  }, [filteredReady, currentPage, rowsPerPage]);

  return (
    <div className="flex flex-col gap-space-xl max-w-[1280px] w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <h1 className="font-page-title text-page-title text-text">Queue Dashboard</h1>
          <p className="font-body text-body text-text-muted">{cfg.queueSubtitle}</p>
        </div>
        <div className="w-full md:w-80 relative">
          <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-text-disabled text-[20px] pointer-events-none">
            search
          </span>
          <input
            className="w-full h-10 pl-10 pr-space-md bg-surface border border-border rounded-lg font-body text-body text-text placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary-container"
            id="batch-search-input"
            placeholder="Search by Batch ID, e.g. WB-2026..."
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Count / KPI Summary Cards (Exactly 3 from §4.1) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-lg">
        {/* Card 1: Ready */}
        <div
          className={`cursor-pointer bg-surface rounded-xl border p-space-xl flex flex-col justify-between hover:bg-background transition-colors ${
            activeTab === 'ready'
              ? 'border-primary-container ring-1 ring-primary-container'
              : 'border-border'
          }`}
          onClick={() => {
            setActiveTab('ready');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted whitespace-nowrap">Ready</span>
            <span className="w-2.5 h-2.5 rounded-full bg-primary-container"></span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <span className="font-kpi-number text-kpi-number text-text text-2xl font-bold">
              {isLoading ? '—' : counts.ready_count}
            </span>
            <span className="font-caption text-caption text-primary-container whitespace-nowrap">
              Action needed
            </span>
          </div>
        </div>

        {/* Card 2: Locked */}
        <div
          className={`cursor-pointer bg-surface rounded-xl border p-space-xl flex flex-col justify-between hover:bg-background transition-colors ${
            activeTab === 'locked'
              ? 'border-badge-transit-text ring-1 ring-badge-transit-text'
              : 'border-border'
          }`}
          onClick={() => {
            setActiveTab('locked');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted whitespace-nowrap">Locked</span>
            <span className="material-symbols-outlined text-[18px] text-badge-transit-text">
              lock
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <span className="font-kpi-number text-kpi-number text-text text-2xl font-bold">
              {isLoading ? '—' : counts.locked_count}
            </span>
            <span className="font-caption text-caption text-badge-transit-text whitespace-nowrap">
              Waiting previous stage
            </span>
          </div>
        </div>

        {/* Card 3: Submitted */}
        <div
          className={`cursor-pointer bg-surface rounded-xl border p-space-xl flex flex-col justify-between hover:bg-background transition-colors ${
            activeTab === 'submitted'
              ? 'border-text-muted ring-1 ring-text-muted'
              : 'border-border'
          }`}
          onClick={() => {
            setActiveTab('submitted');
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted whitespace-nowrap">
              Submitted
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-badge-created-text"></span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <span className="font-kpi-number text-kpi-number text-text text-2xl font-bold">
              {isLoading ? '—' : counts.submitted_count}
            </span>
            <span className="font-caption text-caption text-text-muted whitespace-nowrap">
              Completed entries
            </span>
          </div>
        </div>
      </div>

      {/* Main Container: Tabs & Data View */}
      <div className="bg-surface border border-border rounded-xl flex flex-col overflow-hidden shadow-sm">
        {/* Tab Header Strip */}
        <div className="flex items-center border-b border-border px-space-lg bg-surface overflow-x-auto">
          <button
            className={`flex items-center gap-space-xs py-space-md px-space-md font-body-medium text-body-medium transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'ready'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            id="tab-btn-ready"
            onClick={() => setActiveTab('ready')}
          >
            <span className="whitespace-nowrap">Ready</span>
            <span className="font-badge text-badge px-space-xs py-[1px] rounded-full bg-badge-completed-bg text-badge-completed-text whitespace-nowrap">
              {counts.ready_count}
            </span>
          </button>

          <button
            className={`flex items-center gap-space-xs py-space-md px-space-md font-body-medium text-body-medium transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'locked'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            id="tab-btn-locked"
            onClick={() => setActiveTab('locked')}
          >
            <span className="whitespace-nowrap">Locked</span>
            <span className="font-badge text-badge px-space-xs py-[1px] rounded-full bg-badge-transit-bg text-badge-transit-text whitespace-nowrap">
              {counts.locked_count}
            </span>
          </button>

          <button
            className={`flex items-center gap-space-xs py-space-md px-space-md font-body-medium text-body-medium transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activeTab === 'submitted'
                ? 'border-primary-container text-primary-container'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            id="tab-btn-submitted"
            onClick={() => setActiveTab('submitted')}
          >
            <span className="whitespace-nowrap">Submitted</span>
            <span className="font-badge text-badge px-space-xs py-[1px] rounded-full bg-badge-created-bg text-badge-created-text whitespace-nowrap">
              {counts.submitted_count}
            </span>
          </button>
        </div>

        {/* Tab Content 1: Ready Panel */}
        {activeTab === 'ready' && (
          <div className="flex flex-col" id="panel-ready">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[840px] text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border h-10">
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Batch ID
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Waste Type
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Qty (kg)
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Source / Area
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Route
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Assigned Date (IST)
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-body text-body">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-space-lg py-8 text-center text-text-muted font-body">
                        Loading active queue batches...
                      </td>
                    </tr>
                  ) : paginatedReady.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-space-lg py-8 text-center text-text-muted font-body">
                        {searchQuery
                          ? `No batches match "${searchQuery}" in ready queue.`
                          : 'No batches ready for action in this queue.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedReady.map((batch) => (
                      <tr key={batch.id || batch.batch_code} className="h-12 hover:bg-background transition-colors">
                        <td className="px-space-lg whitespace-nowrap">
                          <Link
                            to={`${cfg.prefix}/batches/${batch.batch_code}`}
                            className="font-batch-id text-batch-id text-primary-container hover:underline"
                          >
                            {batch.batch_code}
                          </Link>
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <div className="flex items-center gap-space-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                batch.waste_type === 'WET' ? 'bg-primary-container' : 'bg-badge-transit-text'
                              }`}
                            ></span>
                            <span className="text-text">
                              {batch.waste_type === 'WET' ? 'Wet Organic' : 'Dry Recyclable'}
                            </span>
                          </div>
                        </td>
                        <td className="px-space-lg whitespace-nowrap font-medium text-text">
                          {Number(batch.quantity).toLocaleString()} kg
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text">
                          {batch.source_area || '—'}
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text-muted">
                          {batch.route_name || batch.route_code || '—'}
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text-muted">
                          {formatDateTime(batch.assigned_at || batch.batch_date)}
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <StatusBadge status={batch.current_status} />
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-right">
                          <Link
                            to={`${cfg.prefix}/batches/${batch.batch_code}/entry`}
                            className="inline-flex items-center justify-center h-9 px-space-md bg-primary-container hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg transition-colors"
                          >
                            Add Entry
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            {filteredReady.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md px-space-lg py-space-md border-t border-border bg-surface">
                <span className="font-caption text-caption text-text-muted">
                  Showing{' '}
                  <span className="font-medium text-text">
                    {Math.min(1 + (currentPage - 1) * rowsPerPage, filteredReady.length)}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium text-text">
                    {Math.min(currentPage * rowsPerPage, filteredReady.length)}
                  </span>{' '}
                  of <span className="font-medium text-text">{filteredReady.length}</span> ready batches
                </span>
                <div className="flex items-center gap-space-md">
                  <div className="flex items-center gap-space-xs text-text-muted font-caption text-caption">
                    <span>Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-surface border border-border rounded px-1.5 py-0.5 font-caption text-caption text-text focus:outline-none"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="h-8 w-8 flex items-center justify-center rounded border border-border text-text disabled:text-text-disabled disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <span className="text-xs px-2 text-text font-medium">
                      {currentPage} / {totalPagesReady}
                    </span>
                    <button
                      disabled={currentPage >= totalPagesReady}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPagesReady, prev + 1))}
                      className="h-8 w-8 flex items-center justify-center rounded border border-border text-text disabled:text-text-disabled disabled:opacity-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Locked Panel */}
        {activeTab === 'locked' && (
          <div className="flex flex-col" id="panel-locked">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border h-10">
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Batch ID
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Waste Type
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Qty (kg)
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Source / Area
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Route
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Lock Reason
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-body text-body">
                  {filteredLocked.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-space-lg py-8 text-center text-text-muted font-body">
                        No locked batches currently pending predecessor handovers.
                      </td>
                    </tr>
                  ) : (
                    filteredLocked.map((batch) => (
                      <tr key={batch.id || batch.batch_code} className="h-12 hover:bg-background transition-colors">
                        <td className="px-space-lg whitespace-nowrap">
                          <Link
                            to={`${cfg.prefix}/batches/${batch.batch_code}`}
                            className="font-batch-id text-batch-id text-text-muted hover:underline"
                          >
                            {batch.batch_code}
                          </Link>
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <div className="flex items-center gap-space-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                batch.waste_type === 'WET' ? 'bg-primary-container' : 'bg-badge-transit-text'
                              }`}
                            ></span>
                            <span className="text-text">
                              {batch.waste_type === 'WET' ? 'Wet Organic' : 'Dry Recyclable'}
                            </span>
                          </div>
                        </td>
                        <td className="px-space-lg whitespace-nowrap font-medium text-text">
                          {Number(batch.quantity).toLocaleString()} kg
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text">
                          {batch.source_area || '—'}
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text-muted">
                          {batch.route_name || batch.route_code || '—'}
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <div className="flex items-center gap-space-xs text-badge-transit-text">
                            <span className="material-symbols-outlined text-[16px]">lock</span>
                            <span className="font-caption text-caption">
                              {batch.lock_reason || 'Waiting for previous stage completion'}
                            </span>
                          </div>
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-right">
                          <button
                            className="inline-flex items-center justify-center h-8 px-space-md bg-badge-created-bg text-text-disabled font-body-medium text-xs rounded-lg cursor-not-allowed"
                            disabled
                          >
                            Locked
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-space-lg py-space-md border-t border-border bg-surface text-text-muted font-caption text-caption">
              Showing {filteredLocked.length} locked batches awaiting upstream workflow completion
            </div>
          </div>
        )}

        {/* Tab Content 3: Submitted Panel */}
        {activeTab === 'submitted' && (
          <div className="flex flex-col" id="panel-submitted">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-background border-b border-border h-10">
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Batch ID
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Waste Type
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Gross Qty
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Current Stage
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-space-lg font-label text-label text-text-muted font-medium whitespace-nowrap text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-body text-body">
                  {filteredSubmitted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-space-lg py-8 text-center text-text-muted font-body">
                        No submitted manifests logged yet by this operator.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmitted.map((batch) => (
                      <tr key={batch.id || batch.batch_code} className="h-12 hover:bg-background transition-colors">
                        <td className="px-space-lg whitespace-nowrap">
                          <Link
                            to={`${cfg.prefix}/batches/${batch.batch_code}`}
                            className="font-batch-id text-batch-id text-primary-container hover:underline"
                          >
                            {batch.batch_code}
                          </Link>
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <div className="flex items-center gap-space-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                batch.waste_type === 'WET' ? 'bg-primary-container' : 'bg-badge-transit-text'
                              }`}
                            ></span>
                            <span className="text-text">
                              {batch.waste_type === 'WET' ? 'Wet Organic' : 'Dry Recyclable'}
                            </span>
                          </div>
                        </td>
                        <td className="px-space-lg whitespace-nowrap font-medium text-text">
                          {Number(batch.quantity).toLocaleString()} kg
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-text-muted">
                          {batch.current_stage || cfg.roleKey}
                        </td>
                        <td className="px-space-lg whitespace-nowrap">
                          <StatusBadge status={batch.current_status} />
                        </td>
                        <td className="px-space-lg whitespace-nowrap text-right">
                          <Link
                            to={`${cfg.prefix}/batches/${batch.batch_code}`}
                            className="inline-flex items-center justify-center h-8 px-space-md bg-surface border border-border hover:bg-background text-text font-body-medium text-caption rounded-lg transition-colors"
                          >
                            View Batch
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-space-lg py-space-md border-t border-border bg-surface text-text-muted font-caption text-caption">
              Showing {filteredSubmitted.length} submitted manifests logged by this station
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
