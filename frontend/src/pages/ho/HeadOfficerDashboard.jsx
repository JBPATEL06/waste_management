import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboardApi';
import { masterApi } from '../../api/masterApi';
import StatusBadge from '../../components/common/StatusBadge';

function getFilterDates(filterKey) {
  if (filterKey === 'all') return {};
  const now = new Date();
  const end_date = now.toISOString().split('T')[0];
  let start = new Date();
  if (filterKey === 'today') {
    start = now;
  } else if (filterKey === '7d') {
    start.setDate(now.getDate() - 7);
  } else if (filterKey === '30d') {
    start.setDate(now.getDate() - 30);
  }
  const start_date = start.toISOString().split('T')[0];
  return { start_date, end_date };
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function HeadOfficerDashboard() {
  const [dateFilter, setDateFilter] = useState('7d');
  const [wasteType, setWasteType] = useState('ALL');
  const [route, setRoute] = useState('ALL');
  const [vehicle, setVehicle] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const handleResetFilters = () => {
    setDateFilter('7d');
    setWasteType('ALL');
    setRoute('ALL');
    setVehicle('ALL');
    setStatus('ALL');
  };

  const queryFilters = useMemo(() => {
    const dates = getFilterDates(dateFilter);
    return {
      ...dates,
      waste_type: wasteType !== 'ALL' ? wasteType : undefined,
      route_id: route !== 'ALL' ? route : undefined,
      vehicle_id: vehicle !== 'ALL' ? vehicle : undefined,
      status: status !== 'ALL' ? status : undefined,
    };
  }, [dateFilter, wasteType, route, vehicle, status]);

  // Master lists
  const { data: routesData } = useQuery({
    queryKey: ['masters', 'routes'],
    queryFn: () => masterApi.getRoutes(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['masters', 'vehicles'],
    queryFn: () => masterApi.getVehicles(),
    staleTime: 5 * 60 * 1000,
  });

  const routes = routesData?.items || [];
  const vehicles = vehiclesData?.items || [];

  // Summary KPIs & Funnel
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['hoDashboardSummary', queryFilters],
    queryFn: () => dashboardApi.getSummary(queryFilters),
    staleTime: 30 * 1000,
  });

  // Breakdowns
  const { data: breakdownData } = useQuery({
    queryKey: ['hoDashboardBreakdowns', queryFilters],
    queryFn: () => dashboardApi.getBreakdowns(queryFilters),
    staleTime: 30 * 1000,
  });

  // Recent Updates & Flagged Variances
  const { data: recentData } = useQuery({
    queryKey: ['hoDashboardRecent', queryFilters],
    queryFn: () => dashboardApi.getRecent(queryFilters),
    staleTime: 30 * 1000,
  });

  const kpis = summaryData?.kpis || {
    total: 0,
    created: 0,
    collected: 0,
    in_transit: 0,
    at_rts: 0,
    completed: 0,
    total_initial_quantity: 0,
  };

  const funnel = summaryData?.funnel || {
    collected_kg: 0,
    rts_received_kg: 0,
    processed_kg: 0,
    net_loss_kg: 0,
    retention_rate_pct: 0,
  };

  // Streams calculation
  const wasteTypeBreakdown = breakdownData?.by_waste_type || [];
  const wetItem = wasteTypeBreakdown.find((w) => w.name === 'WET');
  const dryItem = wasteTypeBreakdown.find((w) => w.name === 'DRY');
  const wetQty = wetItem ? Number(wetItem.quantity) : 0;
  const dryQty = dryItem ? Number(dryItem.quantity) : 0;
  const totalWasteQty = wetQty + dryQty;
  const wetPct = totalWasteQty > 0 ? Math.round((wetQty / totalWasteQty) * 100) : 50;
  const dryPct = totalWasteQty > 0 ? 100 - wetPct : 50;

  const routeBreakdowns = breakdownData?.by_route || [];
  const facilityBreakdowns = breakdownData?.by_facility || [];
  const flaggedVariances = recentData?.flagged_variances || [];
  const recentUpdates = recentData?.recent_updates || [];

  return (
    <div className="flex flex-col w-full pb-space-2xl space-y-space-xl">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs text-caption font-caption text-text-muted">
            <span>Overview</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-text font-medium">Head Officer Analytics</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-md">
            <h1 className="font-page-title text-page-title text-text tracking-tight">
              Head Officer Dashboard
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <Link
            to="/ho/export"
            className="h-10 px-4 rounded-lg bg-surface border border-border text-text font-body-medium text-body-medium inline-flex items-center gap-2 hover:bg-background transition-colors focus:ring-2 focus:ring-primary-container focus:outline-none"
          >
            <span className="material-symbols-outlined text-[18px] text-text-muted">download</span>
            <span>Export Data</span>
          </Link>
        </div>
      </div>

      {/* 2. Analytical Filter Bar */}
      <div className="w-full bg-surface border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-text-muted text-[18px]">tune</span>
            <span className="font-label text-label text-text font-semibold uppercase tracking-wider">
              Multi-Stream Query Filters
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-text-muted hover:text-text font-body-medium text-body-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-sm">
          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Waste Type */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Waste Type</label>
            <select
              value={wasteType}
              onChange={(e) => setWasteType(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="WET">Wet Organic</option>
              <option value="DRY">Dry Recyclable</option>
            </select>
          </div>

          {/* Route */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Route</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="ALL">All Routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vehicle */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Vehicle</label>
            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="ALL">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_number}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Batch Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-body text-text focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="COLLECTED">Collected</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="AT_RTS">At RTS</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-md">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">Total Batches</span>
          <div className="font-kpi-number text-kpi-number text-text tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.total}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">Created</span>
          <div className="font-kpi-number text-kpi-number text-text tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.created}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">Collected</span>
          <div className="font-kpi-number text-kpi-number text-text tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.collected}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">In Transit</span>
          <div className="font-kpi-number text-kpi-number text-text tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.in_transit}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">At RTS</span>
          <div className="font-kpi-number text-kpi-number text-text tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.at_rts}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <span className="font-label text-label text-text-muted block mb-2">Completed</span>
          <div className="font-kpi-number text-kpi-number text-primary tracking-tight text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.completed}
          </div>
        </div>
      </div>

      {/* 4. Quantity Transit Funnel & Net Intake Card */}
      <div className="w-full bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-section-title text-section-title text-text">Quantity Funnel</h2>
          <p className="font-body text-body text-text-muted">
            Cumulative gross mass tracking across key custody handover points
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted mb-2">Stage 1 · Ward Collection</span>
            <div className="text-[28px] leading-8 font-semibold text-text tracking-tight">
              {Number(funnel.collected_kg).toLocaleString()}{' '}
              <span className="text-sm font-normal text-text-muted">kg</span>
            </div>
            <div className="mt-3 pt-2 border-t border-border text-caption font-caption text-text-muted">
              {kpis.total} Batches Logged
            </div>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted mb-2">Stage 2 · RTS Intake Gate</span>
            <div className="text-[28px] leading-8 font-semibold text-text tracking-tight">
              {Number(funnel.rts_received_kg).toLocaleString()}{' '}
              <span className="text-sm font-normal text-text-muted">kg</span>
            </div>
            <div className="mt-3 pt-2 border-t border-border text-caption font-caption text-text-muted">
              Verified weight upon arrival
            </div>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted mb-2">Stage 3 · Facility Reception</span>
            <div className="text-[28px] leading-8 font-semibold text-text tracking-tight">
              {Number(funnel.processed_kg).toLocaleString()}{' '}
              <span className="text-sm font-normal text-text-muted">kg</span>
            </div>
            <div className="mt-3 pt-2 border-t border-border text-caption font-caption text-text-muted">
              Delivered to bio &amp; recovery units ({funnel.retention_rate_pct}% retention)
            </div>
          </div>
        </div>
      </div>

      {/* 5. Breakdown Cards & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
        {/* Card A: Waste Streams & Routes */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-section-title text-section-title text-text">
                Breakdown by Waste Stream &amp; Route
              </h2>
              <span className="text-caption font-caption text-text-muted">
                {totalWasteQty.toLocaleString()} kg Total
              </span>
            </div>

            {/* Waste Stream Proportion */}
            <div className="mb-6 p-4 rounded-lg bg-background border border-border">
              <div className="flex justify-between text-caption font-caption mb-1.5">
                <span className="font-medium text-text">
                  Wet Organic ({wetPct}% · {wetQty.toLocaleString()} kg)
                </span>
                <span className="font-medium text-text">
                  Dry Recyclable ({dryPct}% · {dryQty.toLocaleString()} kg)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden flex">
                <div className="bg-primary-container h-full" style={{ width: `${wetPct}%` }}></div>
                <div className="bg-badge-collected-text h-full" style={{ width: `${dryPct}%` }}></div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-caption font-caption text-text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary-container"></span>
                  <span>Wet (Bio-Degradable)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-badge-collected-text"></span>
                  <span>Dry (Recoverable)</span>
                </div>
              </div>
            </div>

            {/* Top Routes List */}
            <span className="font-label text-label text-text-muted uppercase tracking-wider block mb-3">
              Corridor Volumes
            </span>
            <div className="space-y-3">
              {routeBreakdowns.length === 0 ? (
                <p className="text-sm text-text-muted py-2 text-center">No route intake recorded.</p>
              ) : (
                routeBreakdowns.map((r) => {
                  const maxRouteQty = Math.max(...routeBreakdowns.map((item) => item.quantity), 1);
                  const pct = Math.max(10, Math.round((r.quantity / maxRouteQty) * 100));
                  return (
                    <div key={r.id || r.code}>
                      <div className="flex justify-between text-body-medium font-body-medium mb-1">
                        <span className="text-text">{r.code} - {r.name}</span>
                        <span className="text-text font-semibold">
                          {Number(r.quantity).toLocaleString()} kg{' '}
                          <span className="text-text-muted text-caption font-normal">
                            ({r.count} batches)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                        <div
                          className="bg-secondary h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Card B: Facility Processing */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-section-title text-section-title text-text">
                Facility Reception Volumes
              </h2>
              <span className="text-caption font-caption text-text-muted">
                {Number(funnel.processed_kg).toLocaleString()} kg Processed
              </span>
            </div>

            <div className="space-y-2.5 mb-6">
              {facilityBreakdowns.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No facility reception data available yet.
                </p>
              ) : (
                facilityBreakdowns.map((f) => (
                  <div
                    key={f.id || f.name}
                    className="p-3 bg-background rounded-lg border border-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-primary-container">
                        recycling
                      </span>
                      <div>
                        <div className="font-body-medium text-body-medium text-text">{f.name}</div>
                        <div className="font-caption text-caption text-text-muted">
                          {f.count} batches processed
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-body-medium text-body-medium font-semibold text-text">
                        {Number(f.quantity).toLocaleString()} kg
                      </div>
                      <span className="font-badge text-badge px-2 py-0.5 rounded-full bg-badge-completed-bg text-badge-completed-text">
                        Completed
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-border flex items-center justify-between text-caption font-caption text-text-muted">
            <span>Aggregated Node Records</span>
            <span className="text-badge-completed-text font-medium">Optimal flow compliance</span>
          </div>
        </div>
      </div>

      {/* 6. Flagged Variances Table */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="font-section-title text-section-title text-text">
              Flagged RTS Weight Variances
            </h2>
            <span className="font-badge text-badge px-2.5 py-0.5 rounded-full bg-warning-soft text-badge-transit-text font-semibold">
              {flaggedVariances.length} Flagged Alerts
            </span>
          </div>
          <span className="text-caption font-caption text-text-muted">
            Strict supervisor audit review
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="bg-background text-label font-label text-text-muted border-b border-border">
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">RTS Station</th>
                <th className="py-3 px-4">RTS Received</th>
                <th className="py-3 px-4">Variance (%)</th>
                <th className="py-3 px-4">Logged Time (IST)</th>
                <th className="py-3 px-4 text-right">Audit Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-body text-body text-text">
              {flaggedVariances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-muted text-sm">
                    No flagged variances recorded for selected filters.
                  </td>
                </tr>
              ) : (
                flaggedVariances.map((v) => (
                  <tr key={v.batch_id || v.batch_code} className="hover:bg-background transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Link
                        to={`/ho/batches/${v.batch_code}`}
                        className="font-batch-id text-batch-id text-text hover:underline"
                      >
                        {v.batch_code}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-body-medium">{v.rts_name || '—'}</td>
                    <td className="py-3.5 px-4 font-medium">
                      {Number(v.quantity_received).toLocaleString()} kg
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-badge text-badge px-2.5 py-1 rounded-full bg-warning-soft text-badge-transit-text font-semibold inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        {Number(v.variance_pct) > 0 ? `+${v.variance_pct}%` : `${v.variance_pct}%`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-caption font-caption text-text-muted whitespace-nowrap">
                      {formatDateTime(v.event_time)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/ho/batches/${v.batch_code}`}
                        className="inline-flex items-center gap-1 text-primary-container hover:text-primary-hover font-body-medium text-body-medium"
                      >
                        <span>View Details</span>
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Recent Chain-of-Custody Events */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-section-title text-section-title text-text">Recent Updates</h2>
            <p className="font-body text-body text-text-muted">
              Latest custody transfers and batch updates across nodes
            </p>
          </div>
          <Link
            to="/ho/batches"
            className="text-caption font-caption text-text-muted hover:text-text flex items-center gap-1"
          >
            <span>View All Batches</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead>
              <tr className="bg-background text-label font-label text-text-muted border-b border-border">
                <th className="py-3 px-4">Batch ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">Timestamp (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-body text-body text-text">
              {recentUpdates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-text-muted text-sm">
                    No recent updates found.
                  </td>
                </tr>
              ) : (
                recentUpdates.map((u) => (
                  <tr key={u.id || u.batch_code} className="hover:bg-background transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap font-batch-id text-batch-id text-text">
                      <Link to={`/ho/batches/${u.batch_code}`} className="hover:underline">
                        {u.batch_code}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={u.current_status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-body-medium text-body-medium text-text">
                        {u.route_name || 'Standard Corridor'}
                      </div>
                      <div className="text-caption font-caption text-text-muted">
                        {Number(u.quantity).toLocaleString()} kg ({u.waste_type})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-caption font-caption text-text-muted whitespace-nowrap">
                      {formatDateTime(u.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
