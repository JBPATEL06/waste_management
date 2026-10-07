import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { batchesApi } from '../api/batchesApi';
import { masterApi } from '../api/masterApi';
import { dashboardApi } from '../api/dashboardApi';
import StatusBadge from '../components/common/StatusBadge';
import { formatDateTime } from '../utils/formatDateTime';
import { TableSkeleton } from '../components/Skeleton';

export default function BatchList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'ALL';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(statusParam);
  const [selectedWasteType, setSelectedWasteType] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();
  const pageSize = 10;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleStatusKPI = (status) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    if (status === 'ALL') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', status);
    }
    setSearchParams(searchParams);
  };

  // Fetch KPI counts from dashboard summary
  const { data: summaryData } = useQuery({
    queryKey: ['batchListKpis'],
    queryFn: () => dashboardApi.getSummary(),
    staleTime: 30 * 1000,
  });

  const kpis = summaryData?.kpis || {
    total: 0,
    created: 0,
    collected: 0,
    in_transit: 0,
    at_rts: 0,
    completed: 0,
  };

  // Fetch routes for filter
  const { data: routesData } = useQuery({
    queryKey: ['masters', 'routes'],
    queryFn: () => masterApi.getItems('routes'),
  });

  const routes = routesData?.items || [];

  // Query batches with server-side pagination and filters
  const queryParams = {
    page: currentPage,
    limit: pageSize,
    ...(selectedStatus !== 'ALL' ? { status: selectedStatus } : {}),
    ...(selectedWasteType !== 'ALL' ? { waste_type: selectedWasteType } : {}),
    ...(selectedRoute !== 'ALL' ? { route_id: selectedRoute } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data: batchesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['batchesList', queryParams],
    queryFn: () => batchesApi.getBatches(queryParams),
  });

  const batches = batchesData?.batches || [];
  const total = batchesData?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prefetchBatch = (batchCode) => queryClient.prefetchQuery({
    queryKey: ['batchDetail', batchCode],
    queryFn: () => batchesApi.getBatch(batchCode),
    staleTime: 15 * 1000,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-page-title text-page-title text-text tracking-tight">Batches</h1>
          <p className="font-body text-body text-text-muted mt-0.5">
            Monitor real-time transit status, custodial handovers, and chain-of-custody manifests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/batches/new"
            className="h-10 px-4 bg-primary hover:bg-primary-hover text-white font-label text-label rounded-lg inline-flex items-center gap-2 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Create Batch</span>
          </Link>
        </div>
      </div>

      {/* Quick Lifecycle KPI Status Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => handleStatusKPI('ALL')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'ALL' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">All Batches</span>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.total}</span>
        </button>

        <button
          onClick={() => handleStatusKPI('CREATED')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'CREATED' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">Created</span>
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.created}</span>
        </button>

        <button
          onClick={() => handleStatusKPI('COLLECTED')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'COLLECTED' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">Collected</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.collected}</span>
        </button>

        <button
          onClick={() => handleStatusKPI('IN_TRANSIT')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'IN_TRANSIT' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">In Transit</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.in_transit}</span>
        </button>

        <button
          onClick={() => handleStatusKPI('AT_RTS')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'AT_RTS' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">At RTS</span>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.at_rts}</span>
        </button>

        <button
          onClick={() => handleStatusKPI('COMPLETED')}
          className={`flex flex-col p-3.5 bg-surface border rounded-xl text-left transition-all cursor-pointer ${
            selectedStatus === 'COMPLETED' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-label text-label text-text-muted">Completed</span>
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
          </div>
          <span className="font-kpi-number text-kpi-number text-text mt-1 text-xl font-bold">{kpis.completed}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <span className="material-symbols-outlined text-text-disabled absolute left-3 top-2.5 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by batch code or source area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-surface text-text font-body text-body rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
          </div>

          <select
            value={selectedWasteType}
            onChange={(e) => {
              setSelectedWasteType(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-3 bg-surface text-text font-body text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="ALL">All Waste Types</option>
            <option value="WET">Wet Waste</option>
            <option value="DRY">Dry Waste</option>
            <option value="HAZARDOUS">Hazardous</option>
            <option value="ELECTRONIC">E-Waste</option>
          </select>

          <select
            value={selectedRoute}
            onChange={(e) => {
              setSelectedRoute(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-3 bg-surface text-text font-body text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="ALL">All Routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} - {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedStatus('ALL');
              setSelectedWasteType('ALL');
              setSelectedRoute('ALL');
              setCurrentPage(1);
            }}
            className="h-9 px-3 text-text-muted hover:text-text font-body-medium text-xs rounded-lg border border-border hover:bg-background transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset</span>
          </button>
        </div>

        <span className="font-caption text-caption text-text-muted whitespace-nowrap self-end sm:self-center">
          Showing {batches.length} of {total} batches
        </span>
      </div>

      {/* Batch Listing Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-xs">
        {isLoading && <TableSkeleton columns={7} />}

        {isError && !batchesData && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center p-4">
            <span className="material-symbols-outlined text-error text-[32px]">error</span>
            <span className="text-sm text-text font-medium">{error?.message || 'Failed to load batches'}</span>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 bg-surface border border-border text-sm rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && (batchesData || !isError) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Batch Code</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Date &amp; Time</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Type</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Quantity</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Source Area</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Route / Vehicle</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium">Current Status</th>
                  <th className="py-3 px-4 font-label text-label text-text-muted font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-text-muted font-body text-sm">
                      No batches found matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          to={`/admin/batches/${batch.batch_code}`}
                          onMouseEnter={() => prefetchBatch(batch.batch_code)}
                          onFocus={() => prefetchBatch(batch.batch_code)}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {batch.batch_code}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-body text-xs text-text-muted">
                        {formatDateTime(batch.created_at)}
                      </td>
                      <td className="py-3.5 px-4 font-body text-sm text-text">
                        {batch.waste_type}
                      </td>
                      <td className="py-3.5 px-4 font-body text-sm text-text font-medium">
                        {Number(batch.quantity).toLocaleString()} kg
                      </td>
                      <td className="py-3.5 px-4 font-body text-sm text-text-muted truncate max-w-[180px]">
                        {batch.source_area}
                      </td>
                      <td className="py-3.5 px-4 font-body text-xs text-text">
                        <div className="flex flex-col">
                          <span className="font-medium text-text">{batch.route_name || 'Route'}</span>
                          <span className="text-text-muted text-[11px] font-mono">{batch.vehicle_number || ''}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={batch.current_status} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/admin/batches/${batch.batch_code}`}
                          onMouseEnter={() => prefetchBatch(batch.batch_code)}
                          onFocus={() => prefetchBatch(batch.batch_code)}
                          className="h-8 px-3 bg-surface hover:bg-slate-100 border border-border text-text font-body-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>View</span>
                          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="h-14 border-t border-border px-4 flex items-center justify-between bg-surface">
          <span className="text-xs text-text-muted">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
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
            <span className="px-3 text-xs font-semibold text-text">{currentPage}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
