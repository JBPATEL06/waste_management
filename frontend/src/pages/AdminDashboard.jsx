import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';
import { masterApi } from '../api/masterApi';
import StatusBadge from '../components/common/StatusBadge';

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

function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function AdminDashboard() {
  // Filter state
  const [dateFilter, setDateFilter] = useState('7d');
  const [wasteTypeFilter, setWasteTypeFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');

  const queryFilters = useMemo(() => {
    const dates = getFilterDates(dateFilter);
    return {
      ...dates,
      waste_type: wasteTypeFilter !== 'ALL' ? wasteTypeFilter : undefined,
      route_id: routeFilter !== 'ALL' ? routeFilter : undefined,
      vehicle_id: vehicleFilter !== 'ALL' ? vehicleFilter : undefined,
    };
  }, [dateFilter, wasteTypeFilter, routeFilter, vehicleFilter]);

  // Master dropdown data
  const { data: routesData } = useQuery({
    queryKey: ['masters', 'routes'],
    queryFn: () => masterApi.getRoutes(),
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['masters', 'vehicles'],
    queryFn: () => masterApi.getVehicles(),
  });

  const routes = routesData?.items || [];
  const vehicles = vehiclesData?.items || [];

  // Summary KPIs & Funnel
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['dashboardSummary', queryFilters],
    queryFn: () => dashboardApi.getSummary(queryFilters),
  });

  // Breakdowns
  const { data: breakdownData } = useQuery({
    queryKey: ['dashboardBreakdowns', queryFilters],
    queryFn: () => dashboardApi.getBreakdowns(queryFilters),
  });

  // Pending Actions
  const { data: pendingData } = useQuery({
    queryKey: ['dashboardPending', queryFilters],
    queryFn: () => dashboardApi.getPending(queryFilters),
  });

  // Recent & Flagged Variances
  const { data: recentData } = useQuery({
    queryKey: ['dashboardRecent', queryFilters],
    queryFn: () => dashboardApi.getRecent(queryFilters),
  });

  const handleResetFilters = () => {
    setDateFilter('7d');
    setWasteTypeFilter('ALL');
    setRouteFilter('ALL');
    setVehicleFilter('ALL');
  };

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

  const operational = summaryData?.operational || {
    avg_duration_minutes: 0,
    delayed_batches_count: 0,
    flagged_variances_count: 0,
  };

  const rtsFunnelPct =
    funnel.collected_kg > 0
      ? Math.min(100, Math.round((funnel.rts_received_kg / funnel.collected_kg) * 100))
      : 0;

  const processedFunnelPct =
    funnel.collected_kg > 0
      ? Math.min(100, Math.round((funnel.processed_kg / funnel.collected_kg) * 100))
      : 0;

  // Compute Waste Stream allocations
  const wasteTypeBreakdown = breakdownData?.by_waste_type || [];
  const wetItem = wasteTypeBreakdown.find((w) => w.name === 'WET');
  const dryItem = wasteTypeBreakdown.find((w) => w.name === 'DRY');
  const wetQty = wetItem ? Number(wetItem.quantity) : 0;
  const dryQty = dryItem ? Number(dryItem.quantity) : 0;
  const totalWasteQty = wetQty + dryQty;
  const wetPct = totalWasteQty > 0 ? Math.round((wetQty / totalWasteQty) * 100) : 50;
  const dryPct = totalWasteQty > 0 ? 100 - wetPct : 50;

  // Batch status counts
  const inProgressCount = kpis.collected + kpis.in_transit + kpis.at_rts;
  const completedPct = kpis.total > 0 ? Math.round((kpis.completed / kpis.total) * 100) : 0;
  const inProgressPct = kpis.total > 0 ? Math.round((inProgressCount / kpis.total) * 100) : 0;
  const pendingPct = kpis.total > 0 ? Math.max(0, 100 - completedPct - inProgressPct) : 0;

  // Downstream locations
  const rtsBreakdown = breakdownData?.by_rts || [];
  const facilityBreakdown = breakdownData?.by_facility || [];

  const maxDownstreamQty = Math.max(
    ...rtsBreakdown.map((r) => r.quantity),
    ...facilityBreakdown.map((f) => f.quantity),
    1
  );

  const pendingPersonnel = pendingData?.pending_per_stage_per_user || [];
  const flaggedVariances = recentData?.flagged_variances || [];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-page-title text-page-title text-text">Operational Analytics</h1>
          <p className="font-body text-body text-text-muted mt-0.5">
            Real-time aggregate telemetry, custody checkpoints, and system variances.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/batches/new"
            className="h-10 px-4 bg-primary hover:bg-primary-hover text-on-primary font-body-medium text-body-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Batch</span>
          </Link>
        </div>
      </div>

      {/* 2. Global Filter Bar */}
      <section className="bg-surface rounded-xl border border-border p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 px-3 bg-surface rounded-lg border border-border text-text font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
              value={wasteTypeFilter}
              onChange={(e) => setWasteTypeFilter(e.target.value)}
              className="h-9 px-3 bg-surface rounded-lg border border-border text-text font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Types</option>
              <option value="WET">Wet Waste</option>
              <option value="DRY">Dry Waste</option>
            </select>
          </div>

          {/* Route */}
          <div className="flex flex-col gap-1">
            <label className="font-label text-label text-text-muted">Route</label>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="h-9 px-3 bg-surface rounded-lg border border-border text-text font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="h-9 px-3 bg-surface rounded-lg border border-border text-text font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_number}
                </option>
              ))}
            </select>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-9 px-3 bg-surface hover:bg-background border border-border rounded-lg font-body-medium text-xs text-text flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-text-muted">restart_alt</span>
            <span>Reset Filters</span>
          </button>
        </div>
      </section>

      {/* 3. KPI Cards Row (Clickable) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Batches */}
        <Link
          to="/admin/batches"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">Total Batches</p>
          <p className="font-kpi-number text-kpi-number text-text mt-1 group-hover:text-primary transition-colors text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.total}
          </p>
        </Link>

        {/* Created */}
        <Link
          to="/admin/batches?status=CREATED"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">Created</p>
          <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.created}
          </p>
        </Link>

        {/* Collected */}
        <Link
          to="/admin/batches?status=COLLECTED"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">Collected</p>
          <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.collected}
          </p>
        </Link>

        {/* In Transit */}
        <Link
          to="/admin/batches?status=IN_TRANSIT"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">In Transit</p>
          <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.in_transit}
          </p>
        </Link>

        {/* At RTS */}
        <Link
          to="/admin/batches?status=AT_RTS"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">At RTS</p>
          <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.at_rts}
          </p>
        </Link>

        {/* Completed */}
        <Link
          to="/admin/batches?status=COMPLETED"
          className="bg-surface rounded-xl border border-border p-4 hover:border-text-disabled transition-all flex flex-col justify-between group shadow-sm"
        >
          <p className="font-label text-label text-text-muted">Completed</p>
          <p className="font-kpi-number text-kpi-number text-primary mt-1 text-2xl font-bold">
            {isSummaryLoading ? '—' : kpis.completed}
          </p>
        </Link>
      </section>

      {/* 4. Quantity Funnel Section */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="pb-4 border-b border-border">
          <h2 className="font-section-title text-section-title text-text">Quantity Funnel</h2>
          <p className="font-body text-body text-text-muted mt-0.5">
            Physical mass retention throughout the chain of custody
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          {/* Step 1 */}
          <div className="flex flex-col space-y-2">
            <span className="font-label text-label text-text-muted uppercase tracking-wider">
              1. Initial Collection
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-kpi-number text-kpi-number text-text font-bold text-2xl">
                {Number(funnel.collected_kg).toLocaleString()}
              </span>
              <span className="font-body text-body text-text-muted">kg</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
            <p className="font-caption text-caption text-text-muted">{kpis.total} Total Batches</p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col space-y-2">
            <span className="font-label text-label text-text-muted uppercase tracking-wider">
              2. Received at RTS
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-kpi-number text-kpi-number text-text font-bold text-2xl">
                {Number(funnel.rts_received_kg).toLocaleString()}
              </span>
              <span className="font-body text-body text-text-muted">kg</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${rtsFunnelPct}%` }}
              ></div>
            </div>
            <p className="font-caption text-caption text-text-muted">
              {rtsFunnelPct}% mass retained at RTS
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col space-y-2">
            <span className="font-label text-label text-text-muted uppercase tracking-wider">
              3. Final Processed
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-kpi-number text-kpi-number text-text font-bold text-2xl">
                {Number(funnel.processed_kg).toLocaleString()}
              </span>
              <span className="font-body text-body text-text-muted">kg</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${processedFunnelPct}%` }}
              ></div>
            </div>
            <p className="font-caption text-caption text-text-muted">
              {funnel.retention_rate_pct}% end-to-end retention
            </p>
          </div>
        </div>
      </section>

      {/* 5. Distribution Breakdown Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Waste Type & Status */}
        <div className="bg-surface rounded-xl border border-border p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div>
            <h3 className="font-section-title text-section-title text-text">
              Distribution by Waste Type &amp; Status
            </h3>
            <p className="font-body text-body text-text-muted mt-0.5">
              Stream volume allocation and current operational state
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center text-label font-label mb-1.5">
                <span className="text-text font-medium">
                  Wet Waste ({wetPct}% / {wetQty.toLocaleString()} kg)
                </span>
                <span className="text-text-muted">
                  Dry Waste ({dryPct}% / {dryQty.toLocaleString()} kg)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${wetPct}%` }}></div>
                <div className="bg-blue-600 h-full" style={{ width: `${dryPct}%` }}></div>
              </div>
              <div className="flex items-center gap-4 mt-2 font-caption text-caption text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span> Wet (Biodegradable)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span> Dry (Recyclables)
                </span>
              </div>
            </div>

            <div className="pt-2">
              <p className="font-label text-label text-text-muted mb-2">
                Batch Status Breakdown ({kpis.total} Total)
              </p>
              <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${completedPct}%` }}></div>
                <div className="bg-amber-500 h-full" style={{ width: `${inProgressPct}%` }}></div>
                <div className="bg-slate-400 h-full" style={{ width: `${pendingPct}%` }}></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 font-caption text-caption">
                <div className="p-2 bg-background rounded-lg border border-border/60">
                  <span className="text-text-muted block">Completed</span>
                  <span className="font-body-medium text-body-medium text-text font-semibold">
                    {kpis.completed} batches
                  </span>
                </div>
                <div className="p-2 bg-background rounded-lg border border-border/60">
                  <span className="text-text-muted block">In Progress</span>
                  <span className="font-body-medium text-body-medium text-text font-semibold">
                    {inProgressCount} batches
                  </span>
                </div>
                <div className="p-2 bg-background rounded-lg border border-border/60">
                  <span className="text-text-muted block">Pending</span>
                  <span className="font-body-medium text-body-medium text-text font-semibold">
                    {kpis.created} batches
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right pt-2">
            <Link
              to="/admin/batches"
              className="font-body-medium text-body-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Explore complete classification</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Card 2: Volume by RTS & Facilities */}
        <div className="bg-surface rounded-xl border border-border p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <h3 className="font-section-title text-section-title text-text">
              Volume by RTS &amp; Processing Facilities
            </h3>
            <p className="font-body text-body text-text-muted mt-0.5">
              Aggregate tonnage handled by downstream nodes
            </p>
          </div>

          <div className="space-y-3">
            {rtsBreakdown.length === 0 && facilityBreakdown.length === 0 ? (
              <p className="text-sm text-text-muted py-4 text-center">
                No transfer or processing volume recorded yet for selected filter range.
              </p>
            ) : (
              <>
                {rtsBreakdown.map((r) => {
                  const pct = Math.max(8, Math.round((r.quantity / maxDownstreamQty) * 100));
                  return (
                    <div key={r.id || r.name} className="space-y-1">
                      <div className="flex justify-between items-center font-body text-body">
                        <span className="font-body-medium text-body-medium text-text">{r.name}</span>
                        <span className="text-text font-batch-id">
                          {Number(r.quantity).toLocaleString()} kg{' '}
                          <span className="text-text-muted font-normal text-xs">({r.count} batches)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-slate-700 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}

                {facilityBreakdown.map((f) => {
                  const pct = Math.max(8, Math.round((f.quantity / maxDownstreamQty) * 100));
                  return (
                    <div key={f.id || f.name} className="space-y-1">
                      <div className="flex justify-between items-center font-body text-body">
                        <span className="font-body-medium text-body-medium text-text">{f.name}</span>
                        <span className="text-text font-batch-id">
                          {Number(f.quantity).toLocaleString()} kg{' '}
                          <span className="text-text-muted font-normal text-xs">({f.count} batches)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="pt-2 text-right">
            <Link
              to="/admin/master"
              className="font-body-medium text-body-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Manage facility thresholds</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Operational Performance & Pending Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Operational Duration */}
        <div className="bg-surface rounded-xl border border-border p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <h3 className="font-section-title text-section-title text-text">
              Operational Performance &amp; Velocity
            </h3>
            <p className="font-body text-body text-text-muted mt-0.5">
              Velocity KPIs and bottlenecks across transit checkpoints
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-background rounded-lg border border-border">
              <span className="font-label text-label text-text-muted">Avg Transit Duration</span>
              <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
                {formatMinutes(operational.avg_duration_minutes)}
              </p>
              <span className="font-caption text-caption text-text-muted mt-1 block">
                Collection to Transfer / RTS
              </span>
            </div>
            <div className="p-3.5 bg-background rounded-lg border border-border">
              <span className="font-label text-label text-text-muted">Flagged Variances</span>
              <p className="font-kpi-number text-kpi-number text-text mt-1 text-2xl font-bold">
                {operational.flagged_variances_count}
              </p>
              <span className="font-caption text-caption text-text-muted mt-1 block">
                Threshold violations logged
              </span>
            </div>
          </div>

          {/* Stuck / Delayed batches alert */}
          <div className="p-3.5 bg-warning-soft rounded-lg border border-warning/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-warning text-[20px]">warning</span>
                <span className="font-body-medium text-body-medium text-text font-medium">
                  Delayed Batches (&gt; 24h inactive)
                </span>
              </div>
              <span className="font-badge text-badge bg-warning text-white px-2 py-0.5 rounded-full font-medium">
                {operational.delayed_batches_count} Flagged
              </span>
            </div>
            <p className="font-caption text-caption text-text-muted mt-1">
              {operational.delayed_batches_count > 0
                ? 'Follow up with assigned operators to resolve pending custody handovers.'
                : 'All batches currently progressing within expected SLA windows.'}
            </p>
          </div>
        </div>

        {/* Card 2: Pending Actions per User */}
        <div className="bg-surface rounded-xl border border-border p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <h3 className="font-section-title text-section-title text-text">
              Pending Actions per Stage &amp; User
            </h3>
            <p className="font-body text-body text-text-muted mt-0.5">
              Officers currently responsible for batch progression
            </p>
          </div>

          <div className="divide-y divide-border">
            {pendingPersonnel.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No pending queue items across assigned operators.
              </p>
            ) : (
              pendingPersonnel.slice(0, 4).map((p) => {
                const icon =
                  p.role === 'COLLECTION'
                    ? 'inventory_2'
                    : p.role === 'TRANSPORTATION'
                    ? 'local_shipping'
                    : p.role === 'RTS'
                    ? 'sync_alt'
                    : 'recycling';
                return (
                  <div key={p.user_id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-badge-created-bg flex items-center justify-center text-text-muted">
                        <span className="material-symbols-outlined text-[18px]">{icon}</span>
                      </div>
                      <div>
                        <p className="font-body-medium text-body-medium text-text font-medium">
                          {p.user_name}
                        </p>
                        <p className="font-caption text-caption text-text-muted">
                          Stage: {p.role}
                        </p>
                      </div>
                    </div>
                    <span className="font-badge text-badge px-2.5 py-1 bg-badge-created-bg text-badge-created-text rounded-full">
                      {p.pending_count} pending
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-1 text-right">
            <Link
              to="/admin/users"
              className="font-body-medium text-body-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>View all field personnel</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Flagged Variances Alert Table */}
      <section className="bg-surface rounded-xl border border-border p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-section-title text-section-title text-text">
                Flagged Variances (Discrepancy Violations)
              </h3>
              <span className="font-badge text-badge bg-error-soft text-error px-2 py-0.5 rounded-full font-medium">
                {flaggedVariances.length} Active Alerts
              </span>
            </div>
            <p className="font-body text-body text-text-muted mt-0.5">
              Batches exceeding variance threshold between collection and transfer intake.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-border text-text-muted font-label">
              <tr>
                <th className="py-2.5 px-3">Batch Code</th>
                <th className="py-2.5 px-3">RTS Received</th>
                <th className="py-2.5 px-3">Variance</th>
                <th className="py-2.5 px-3">RTS Location</th>
                <th className="py-2.5 px-3">Logged Date</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flaggedVariances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-muted text-sm">
                    No flagged variances recorded for selected filters.
                  </td>
                </tr>
              ) : (
                flaggedVariances.map((v) => (
                  <tr key={v.batch_id || v.batch_code}>
                    <td className="py-3 px-3 font-mono font-semibold text-text">
                      {v.batch_code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-error">
                      {Number(v.quantity_received).toLocaleString()} kg
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-error-soft text-error font-semibold text-xs font-mono">
                        {Number(v.variance_pct) > 0 ? `+${v.variance_pct}%` : `${v.variance_pct}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-muted">{v.rts_name || '—'}</td>
                    <td className="py-3 px-3 text-text-muted">
                      {v.event_time ? new Date(v.event_time).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/admin/batches/${v.batch_code}`}
                        className="text-primary hover:underline font-medium text-xs inline-flex items-center gap-0.5"
                      >
                        Investigate →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
