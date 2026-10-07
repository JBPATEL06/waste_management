import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STAGE_CONFIG } from '../../constants/stages';
import { meApi } from '../../api/meApi';
import { useAuth } from '../../context/AuthContext';

import { formatDateTime } from '../../utils/formatDateTime';
import { TableSkeleton } from '../../components/Skeleton';


export default function StageHistory({ role: propRole }) {
  const location = useLocation();
  const { user } = useAuth();

  // Resolve role config
  let roleKey = propRole;
  if (!roleKey) {
    if (location.pathname.startsWith('/transportation')) roleKey = 'transportation';
    else if (location.pathname.startsWith('/rts')) roleKey = 'rts';
    else if (location.pathname.startsWith('/processing')) roleKey = 'processing';
    else roleKey = 'collection';
  }

  const cfg = STAGE_CONFIG[roleKey] || STAGE_CONFIG.collection;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const queryParams = useMemo(() => {
    return {
      search: debouncedSearch.trim() || undefined,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };
  }, [debouncedSearch, statusFilter, currentPage, pageSize]);

  // Fetch operator's history
  const { data: historyData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['operatorHistory', queryParams],
    queryFn: () => meApi.getHistory(queryParams),
  });

  const entries = historyData?.entries || [];
  const totalEntries = historyData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  // Compute counts from entries
  const activeCount = entries.filter((e) => e.status === 'ACTIVE').length;
  const supersededCount = entries.filter((e) => e.status === 'SUPERSEDED').length;

  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col gap-space-2xl max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <nav className="flex items-center gap-space-xs font-caption text-caption text-text-muted">
            <Link to={`${cfg.prefix}/dashboard`} className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-text font-medium">History</span>
          </nav>
          <h1 className="font-page-title text-page-title text-text tracking-tight">
            Submission History
          </h1>
          <p className="font-body text-body text-text-muted">
            Immutable log of all own submissions across all versions • {user?.name || cfg.roleLabel} ({user?.email})
          </p>
        </div>

        {/* 3 Summary Pills */}
        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          <div className="bg-surface border border-border px-space-md py-space-sm rounded-lg flex items-center gap-space-sm whitespace-nowrap shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span>
            <span className="font-caption text-caption text-text-muted">Total Entries:</span>
            <span className="font-body-medium text-body-medium text-text font-semibold">{totalEntries}</span>
          </div>

          <div className="bg-surface border border-border px-space-md py-space-sm rounded-lg flex items-center gap-space-sm whitespace-nowrap shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary-container shrink-0"></span>
            <span className="font-caption text-caption text-text-muted">Active:</span>
            <span className="font-body-medium text-body-medium text-text font-semibold">{activeCount}</span>
          </div>

          <div className="bg-surface border border-border px-space-md py-space-sm rounded-lg flex items-center gap-space-sm whitespace-nowrap shadow-sm">
            <span className="w-2 h-2 rounded-full bg-text-disabled shrink-0"></span>
            <span className="font-caption text-caption text-text-muted">Superseded:</span>
            <span className="font-body-medium text-body-medium text-text font-semibold">{supersededCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-xl p-space-lg flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md shadow-sm">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-space-md">
          <div className="relative flex-1 min-w-[240px] flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-text-muted text-[18px] pointer-events-none flex items-center justify-center">
              search
            </span>
            <input
              id="searchInput"
              type="text"
              placeholder="Search by Batch ID (e.g. WB-2026)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-9 pr-space-md bg-surface border border-border rounded-lg font-body text-body text-text placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="relative flex items-center">
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 pl-space-md pr-8 bg-surface border border-border rounded-lg font-body text-body text-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-container"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUPERSEDED">Superseded Only</option>
                <option value="DELETED">Deleted Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end shrink-0">
          <button
            id="resetBtn"
            type="button"
            onClick={handleReset}
            className="h-10 px-space-md rounded-lg font-body text-body text-text-muted hover:text-text hover:bg-background transition-colors inline-flex items-center gap-space-xs border border-border cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            <span className="whitespace-nowrap">Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="bg-background border-b border-border h-12">
                <th className="px-space-lg font-label text-label text-text-muted whitespace-nowrap">Batch ID</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Stage</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Version</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Status</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Event Time (IST)</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Submitted At (IST)</th>
                <th className="px-space-md font-label text-label text-text-muted whitespace-nowrap">Location / Quantity</th>
                <th className="px-space-md font-label text-label text-text-muted min-w-[200px]">Reason / Revision Notes</th>
                <th className="px-space-lg font-label text-label text-text-muted text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" id="historyTableBody">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <TableSkeleton columns={9} />
                  </td>
                </tr>
              ) : isError && !historyData ? (
                <tr>
                  <td colSpan={9} className="px-space-lg py-12 text-center text-error">
                    {error?.message || 'Failed to load history logs.'}{' '}
                    <button type="button" onClick={() => refetch()} className="ml-2 underline">Retry</button>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-space-lg py-12 text-center text-text-muted font-body">
                    No submissions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                entries.map((row) => {
                  const isSuperseded = row.status === 'SUPERSEDED';
                  const isDeleted = row.status === 'DELETED';
                  const weight =
                    row.collection_qty ||
                    row.quantity_received ||
                    row.processed_qty ||
                    '—';

                  return (
                    <tr
                      key={row.id}
                      className="h-14 hover:bg-background transition-colors"
                    >
                      <td className="px-space-lg whitespace-nowrap align-middle">
                        <Link
                          to={`${cfg.prefix}/batches/${row.batch_code}`}
                          className={`font-batch-id text-batch-id inline-block whitespace-nowrap ${
                            isSuperseded || isDeleted
                              ? 'text-text-muted hover:underline line-through'
                              : 'text-primary-container hover:underline'
                          }`}
                        >
                          {row.batch_code}
                        </Link>
                      </td>

                      <td
                        className={`px-space-md font-body text-body whitespace-nowrap align-middle ${
                          isSuperseded || isDeleted ? 'text-text-muted' : 'text-text'
                        }`}
                      >
                        {row.stage}
                      </td>

                      <td
                        className={`px-space-md whitespace-nowrap align-middle ${
                          isSuperseded || isDeleted
                            ? 'font-body text-body text-text-muted'
                            : 'font-body-medium text-body-medium text-text'
                        }`}
                      >
                        v{row.version_no}.0
                      </td>

                      <td className="px-space-md whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex items-center font-badge text-badge px-2 py-0.5 rounded-full whitespace-nowrap ${
                            isSuperseded
                              ? 'bg-badge-superseded-bg text-badge-superseded-text'
                              : isDeleted
                              ? 'bg-error-soft text-error'
                              : 'bg-badge-completed-bg text-badge-completed-text'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>

                      <td
                        className={`px-space-md font-body text-body whitespace-nowrap align-middle ${
                          isSuperseded || isDeleted ? 'text-text-muted' : 'text-text'
                        }`}
                      >
                        {formatDateTime(row.event_time)}
                      </td>

                      <td className="px-space-md font-body text-body text-text-muted whitespace-nowrap align-middle">
                        {formatDateTime(row.created_at)}
                      </td>

                      <td className="px-space-md whitespace-nowrap align-middle">
                        <div className="flex flex-col">
                          <span
                            className={`font-body-medium text-body-medium ${
                              isSuperseded || isDeleted ? 'text-text-muted' : 'text-text'
                            }`}
                          >
                            {weight !== '—' ? `${Number(weight).toLocaleString()} kg` : '—'}
                          </span>
                          <span
                            className={`font-caption text-caption ${
                              isSuperseded || isDeleted ? 'text-text-disabled' : 'text-text-muted'
                            }`}
                          >
                            {row.display_location || '—'}
                          </span>
                        </div>
                      </td>

                      <td
                        className="px-space-md font-body text-body text-text-muted max-w-xs align-middle leading-relaxed"
                        title={row.note || row.delete_reason || ''}
                      >
                        <span className="line-clamp-2">
                          {row.delete_reason
                            ? `Deleted: ${row.delete_reason}`
                            : row.note || '—'}
                        </span>
                      </td>

                      <td className="px-space-lg text-right whitespace-nowrap align-middle">
                        <Link
                          to={`${cfg.prefix}/batches/${row.batch_code}`}
                          className={`inline-flex items-center gap-1 ${
                            isSuperseded || isDeleted
                              ? 'font-body text-body text-text-muted hover:text-text'
                              : 'font-body-medium text-body-medium text-primary-container hover:text-primary-hover'
                          }`}
                        >
                          <span>View</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {totalEntries > 0 && (
          <div className="px-space-lg py-space-md border-t border-border flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface">
            <span className="font-caption text-caption text-text-muted whitespace-nowrap">
              Showing <span className="font-medium text-text">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium text-text">{Math.min(currentPage * pageSize, totalEntries)}</span> of{' '}
              <span className="font-medium text-text">{totalEntries}</span> entries
            </span>
            <div className="flex items-center gap-space-xs">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 rounded border border-border bg-surface text-text disabled:text-text-disabled hover:bg-background inline-flex items-center justify-center p-0 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="text-xs px-2 text-text font-medium">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 rounded border border-border bg-surface text-text disabled:text-text-disabled hover:bg-background inline-flex items-center justify-center transition-colors p-0 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
