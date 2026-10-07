import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/auditApi';
import { usersApi } from '../api/usersApi';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/formatDateTime';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function AuditLog() {
  const { user } = useAuth();
  const toast = useToast();
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterUser, setFilterUser] = useState('ALL');
  const [searchBatch, setSearchBatch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchBatch);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchBatch]);

  // Fetch active users for user dropdown
  const { data: usersData } = useQuery({
    queryKey: ['masters', 'users'],
    queryFn: () => usersApi.getUsers(),
    enabled: user?.role === 'ADMIN',
  });

  const usersList = usersData?.users || [];

  // Fetch real audit logs
  const queryParams = {
    page: currentPage,
    limit: parseInt(rowsPerPage, 10),
    ...(filterAction !== 'ALL' ? { action: filterAction } : {}),
    ...(filterUser === 'ME' ? { user_id: user?.id } : filterUser !== 'ALL' ? { user_id: filterUser } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data: auditData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auditLogs', queryParams],
    queryFn: () => auditApi.getLogs(queryParams),
  });

  const entries = auditData?.entries || [];
  const total = auditData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / parseInt(rowsPerPage, 10)));

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const resetFilters = () => {
    setFilterAction('ALL');
    setFilterUser('ALL');
    setSearchBatch('');
    setCurrentPage(1);
  };

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'BATCH_CREATE':
      case 'CREATED':
        return 'bg-badge-created-bg text-badge-created-text';
      case 'ENTRY_CREATE':
      case 'ENTRY_ADDED':
        return 'bg-badge-completed-bg text-badge-completed-text';
      case 'ENTRY_CORRECT':
      case 'CORRECTED':
      case 'ENTRY_UPDATE':
      case 'ENTRY_ADMIN_EDIT':
      case 'BATCH_EDIT':
      case 'MASTER_CHANGE':
        return 'bg-badge-transit-bg text-badge-transit-text';
      case 'ENTRY_ADMIN_DELETE':
      case 'ENTRY_DELETE':
      case 'BATCH_DELETE':
      case 'DELETED':
      case 'USER_DEACTIVATE':
        return 'bg-badge-deleted-bg text-badge-deleted-text';
      case 'PASSWORD_RESET':
      case 'ASSIGN':
      case 'REASSIGN':
        return 'bg-badge-rts-bg text-badge-rts-text';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleExportCsv = () => {
    if (entries.length === 0) return;
    const rows = entries.map((r) =>
      `"${formatDateTime(r.performed_at)}","${r.action}","${r.user_name || 'System'}","${r.batch_code || '—'}","${r.entity_type}","${r.details?.reason || ''}"`
    );
    const csvContent =
      `"Time","Action","User","Batch Code","Entity","Reason"\n` + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_ledger_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Audit log exported successfully.');
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header row with page title & export action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text tracking-tight">Audit Log</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-text-muted font-medium">
              {total} Total Events
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Immutable system ledger recording data operations, state mutations, and operator rationales.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            className="h-10 px-4 rounded-lg bg-surface border border-border text-text text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            onClick={handleExportCsv}
            disabled={entries.length === 0}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-text-muted">download</span>
            Export Audit (CSV)
          </button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Action Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filterAction">
              Action Type
            </label>
            <div className="relative">
              <select
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-8 appearance-none"
                id="filterAction"
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Actions</option>
                <option value="BATCH_CREATE">Batch Created</option>
                <option value="BATCH_EDIT">Batch Edited</option>
                <option value="BATCH_DELETE">Batch Deleted</option>
                <option value="ENTRY_CREATE">Entry Created</option>
                <option value="ENTRY_CORRECT">Entry Corrected</option>
                <option value="ENTRY_ADMIN_EDIT">Entry Edited</option>
                <option value="ENTRY_ADMIN_DELETE">Entry Deleted</option>
                <option value="ASSIGN">Assigned</option>
                <option value="REASSIGN">Reassigned</option>
                <option value="MASTER_CHANGE">Master Data Changed</option>
                <option value="USER_CREATE">User Created</option>
                <option value="USER_UPDATE">User Updated</option>
                <option value="USER_DEACTIVATE">User Deactivated</option>
                <option value="PASSWORD_RESET">Password Reset</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-text-disabled text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* User Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filterUser">
              User
            </label>
            <div className="relative">
              <select
                className="w-full h-10 bg-surface border border-border rounded-lg px-3 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-8 appearance-none"
                id="filterUser"
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Users</option>
                <option value="ME">Current User ({user?.name || 'Me'})</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-text-disabled text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Batch Code Search */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="searchBatch">
              Batch Code Search
            </label>
            <div className="relative">
              <input
                className="w-full h-10 bg-surface border border-border rounded-lg pl-3 pr-8 text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-disabled uppercase"
                id="searchBatch"
                placeholder="e.g. WB-2026-0001"
                type="text"
                value={searchBatch}
                onChange={(e) => {
                  setSearchBatch(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-text-disabled text-[18px]">
                search
              </span>
            </div>
          </div>
        </div>

        {/* Quick filters & resets */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={`h-8 px-3 rounded-full border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                filterUser === 'ME'
                  ? 'bg-primary-soft text-primary border-primary/30 font-semibold'
                  : 'bg-slate-50 border-border text-text-muted hover:bg-slate-100'
              }`}
              onClick={() => {
                setFilterUser(filterUser === 'ME' ? 'ALL' : 'ME');
                setCurrentPage(1);
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-text-muted">person</span>
              Only My Actions
            </button>
            <span className="text-text-disabled text-xs">|</span>
            <button
              className={`h-8 px-3 rounded-full border text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer ${
                filterAction === 'ENTRY_CORRECT'
                  ? 'bg-primary-soft text-primary border-primary/30'
                  : 'bg-surface border-border text-text-muted'
              }`}
              onClick={() => {
                setFilterAction(filterAction === 'ENTRY_CORRECT' ? 'ALL' : 'ENTRY_CORRECT');
                setCurrentPage(1);
              }}
              type="button"
            >
              Corrections
            </button>
            <button
              className={`h-8 px-3 rounded-full border text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer ${
                filterAction === 'ENTRY_ADMIN_DELETE'
                  ? 'bg-primary-soft text-primary border-primary/30'
                  : 'bg-surface border-border text-text-muted'
              }`}
              onClick={() => {
                setFilterAction(filterAction === 'ENTRY_ADMIN_DELETE' ? 'ALL' : 'ENTRY_ADMIN_DELETE');
                setCurrentPage(1);
              }}
              type="button"
            >
              Deletions
            </button>
          </div>
          <button
            className="text-sm font-medium text-primary hover:text-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
            onClick={resetFilters}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reset Filters
          </button>
        </div>
      </div>

      {/* Audit Events Table Card */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col shadow-sm">
        {isLoading && <TableSkeleton columns={7} />}

        {isError && !auditData && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center p-4">
            <span className="material-symbols-outlined text-error text-[32px]">error</span>
            <span className="text-sm text-text font-medium">{error?.message || 'Failed to load audit logs'}</span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 bg-surface border border-border text-sm rounded-lg hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && (auditData || !isError) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border h-12 text-text-muted text-[13px] font-medium">
                  <th className="px-3 w-10"></th>
                  <th className="px-3 whitespace-nowrap">Time</th>
                  <th className="px-3 whitespace-nowrap">Action</th>
                  <th className="px-3 whitespace-nowrap">User</th>
                  <th className="px-3 whitespace-nowrap">Batch Code</th>
                  <th className="px-3 whitespace-nowrap">Entity</th>
                  <th className="px-3 min-w-[240px]">Reason / Rationale</th>
                  <th className="px-3 text-right whitespace-nowrap">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-text">
                {entries.map((item) => {
                  const hasDetails = Boolean(item.details && Object.keys(item.details).length > 0);
                  const isExpanded = Boolean(expandedRows[item.id]);

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`h-12 hover:bg-slate-50/70 transition-colors ${isExpanded ? 'bg-slate-50/40' : ''}`}>
                        <td className="px-3 text-center">
                          {hasDetails ? (
                            <button
                              className="p-1 text-text-muted hover:text-text focus:outline-none cursor-pointer"
                              onClick={() => toggleRow(item.id)}
                              type="button"
                              aria-expanded={isExpanded}
                            >
                              <span
                                className={`material-symbols-outlined text-[18px] transition-transform ${
                                  isExpanded ? 'rotate-90' : ''
                                }`}
                              >
                                chevron_right
                              </span>
                            </button>
                          ) : (
                            <span className="material-symbols-outlined text-[18px] text-text-disabled">remove</span>
                          )}
                        </td>
                        <td className="px-3 whitespace-nowrap text-text-muted text-xs">
                          {formatDateTime(item.performed_at)}
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActionBadgeClass(
                              item.action
                            )}`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text">{item.user_name || 'System'}</span>
                            {item.user_role && (
                              <span className="text-[11px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-700">
                                {item.user_role}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          <span className="font-semibold text-text text-sm">{item.batch_code || '—'}</span>
                        </td>
                        <td className="px-3 whitespace-nowrap text-text-muted text-sm">{item.entity_type}</td>
                        <td className="px-3 text-text text-sm">
                          {item.details?.reason || item.details?.note || '—'}
                        </td>
                        <td className="px-3 text-right whitespace-nowrap">
                          {hasDetails ? (
                            <button
                              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                              onClick={() => toggleRow(item.id)}
                              type="button"
                            >
                              <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                            </button>
                          ) : (
                            <span className="text-text-muted text-xs">No Details</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Diff Ledger Card */}
                      {hasDetails && isExpanded && (
                        <tr className="bg-slate-50 border-y border-border">
                          <td className="p-4" colSpan={8}>
                            <div className="bg-surface rounded-lg border border-border p-4 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                                  Audit Payload Diff &amp; Metadata
                                </span>
                                <span className="text-xs text-text-muted">
                                  Record ID: <strong className="font-mono text-text">{item.id}</strong>
                                </span>
                              </div>

                              <pre className="font-mono text-[12px] text-text bg-background p-3 rounded-lg border border-border overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(item.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-text-muted text-sm">
                      No audit events found matching the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="h-14 border-t border-border px-4 flex flex-col sm:flex-row items-center justify-between gap-2 bg-surface">
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">
              Showing <strong>{entries.length}</strong> of <strong>{total}</strong> events (Page {currentPage} of{' '}
              {totalPages})
            </span>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <label className="text-xs" htmlFor="rowsPerPage">
                Rows:
              </label>
              <select
                className="h-8 border border-border rounded bg-surface text-text text-xs px-2 focus:ring-1 focus:ring-primary"
                id="rowsPerPage"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button
              className={`w-8 h-8 rounded border border-border bg-surface flex items-center justify-center ${
                currentPage === 1 ? 'text-text-disabled cursor-not-allowed' : 'text-text hover:bg-slate-50 cursor-pointer'
              }`}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="px-2 text-xs text-text font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              className={`w-8 h-8 rounded border border-border bg-surface flex items-center justify-center ${
                currentPage >= totalPages
                  ? 'text-text-disabled cursor-not-allowed'
                  : 'text-text hover:bg-slate-50 cursor-pointer'
              }`}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
