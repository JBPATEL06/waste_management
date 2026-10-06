import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exportApi } from '../api/exportApi';
import { masterApi } from '../api/masterApi';
import { batchesApi } from '../api/batchesApi';
import StatusBadge from '../components/common/StatusBadge';

export default function ExportData() {
  const [selectedDataset, setSelectedDataset] = useState('batches');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [wasteTypeFilter, setWasteTypeFilter] = useState('');
  const [format, setFormat] = useState('csv');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch routes and vehicles for dropdown filters
  const { data: routesData } = useQuery({
    queryKey: ['exportRoutes'],
    queryFn: () => masterApi.getItems('routes'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['exportVehicles'],
    queryFn: () => masterApi.getItems('vehicles'),
    staleTime: 5 * 60 * 1000,
  });

  const routesList = routesData?.items || [];
  const vehiclesList = vehiclesData?.items || [];

  const getDateFilterParams = () => {
    const now = new Date();
    if (dateRange === 'Last 7 Days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start_date: past.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) };
    }
    if (dateRange === 'Last 30 Days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start_date: past.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) };
    }
    if (dateRange === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start_date: startOfMonth.toISOString().slice(0, 10), end_date: now.toISOString().slice(0, 10) };
    }
    if (dateRange === 'Custom Range') {
      return {
        ...(customStartDate ? { start_date: customStartDate } : {}),
        ...(customEndDate ? { end_date: customEndDate } : {}),
      };
    }
    return {};
  };

  const activeFilters = {
    ...getDateFilterParams(),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(routeFilter ? { route_id: routeFilter } : {}),
    ...(vehicleFilter ? { vehicle_id: vehicleFilter } : {}),
    ...(wasteTypeFilter ? { waste_type: wasteTypeFilter } : {}),
  };

  // Preview data query (first 10 batches matching current filters)
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['exportPreviewBatches', activeFilters],
    queryFn: () => batchesApi.getBatches({ ...activeFilters, limit: 10 }),
    enabled: showPreviewModal,
  });

  const previewBatches = previewData?.batches || [];

  const resetFilters = () => {
    setDateRange('Last 30 Days');
    setCustomStartDate('');
    setCustomEndDate('');
    setStatusFilter('');
    setRouteFilter('');
    setVehicleFilter('');
    setWasteTypeFilter('');
  };

  const triggerDownload = async () => {
    setDownloading(true);
    try {
      await exportApi.download(selectedDataset, format, activeFilters);
      setToastMessage(`Export downloaded successfully (${selectedDataset}.${format})`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3800);
    } catch (err) {
      alert(err.message || 'Export generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toast Notification */}
      <div
        className={`fixed top-16 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-md bg-primary text-white transition-opacity duration-300 ${
          showToast ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">check_circle</span>
        <span className="font-body text-sm">{toastMessage}</span>
      </div>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Administration</span>
            <span className="text-xs text-text-disabled">/</span>
            <span className="text-xs text-primary font-semibold">Reports &amp; Data</span>
          </div>
          <h1 className="text-2xl font-semibold text-text">Export Data</h1>
          <p className="text-sm text-text-muted mt-1">
            Export filtered system records, stage logs, and audit histories to streamed CSV or Excel workbooks.
          </p>
        </div>
      </div>

      {/* 1. Dataset Selection Card */}
      <section className="bg-surface rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-semibold text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-lg font-semibold text-text">Select Dataset</h2>
          </div>
          <span className="text-xs text-text-muted">Choose 1 target schema</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Dataset 1: Batches */}
          <div
            className={`cursor-pointer p-4 rounded-lg shadow-xs transition-all duration-150 flex flex-col justify-between group border ${
              selectedDataset === 'batches'
                ? 'bg-primary-soft border-primary/30 ring-1 ring-primary'
                : 'bg-surface border-border hover:bg-slate-50'
            }`}
            onClick={() => setSelectedDataset('batches')}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    selectedDataset === 'batches' ? 'text-primary' : 'text-text group-hover:text-primary'
                  }`}
                >
                  Batches
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    selectedDataset === 'batches' ? 'text-primary' : 'text-text-disabled'
                  }`}
                >
                  {selectedDataset === 'batches' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Batch master records, origin wards, assigned operators, vehicle numbers, route codes, and current lifecycle status.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-text-muted border-t border-border">
              <span className="bg-surface px-2 py-0.5 rounded text-[11px] border border-border">Core Master</span>
              <span>Batches Dataset</span>
            </div>
          </div>

          {/* Dataset 2: Stage-wise records */}
          <div
            className={`cursor-pointer p-4 rounded-lg shadow-xs transition-all duration-150 flex flex-col justify-between group border ${
              selectedDataset === 'stage-records'
                ? 'bg-primary-soft border-primary/30 ring-1 ring-primary'
                : 'bg-surface border-border hover:bg-slate-50'
            }`}
            onClick={() => setSelectedDataset('stage-records')}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    selectedDataset === 'stage-records' ? 'text-primary' : 'text-text group-hover:text-primary'
                  }`}
                >
                  Stage-wise records
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    selectedDataset === 'stage-records' ? 'text-primary' : 'text-text-disabled'
                  }`}
                >
                  {selectedDataset === 'stage-records' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Detailed weighbridge logs, arrival &amp; departure timestamps, gross/tare weights, and stage operational notes.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-text-muted border-t border-border">
              <span className="bg-surface px-2 py-0.5 rounded text-[11px] border border-border">Active Stages</span>
              <span>Stage Records</span>
            </div>
          </div>

          {/* Dataset 3: Full history incl. corrections */}
          <div
            className={`cursor-pointer p-4 rounded-lg shadow-xs transition-all duration-150 flex flex-col justify-between group border ${
              selectedDataset === 'full-history'
                ? 'bg-primary-soft border-primary/30 ring-1 ring-primary'
                : 'bg-surface border-border hover:bg-slate-50'
            }`}
            onClick={() => setSelectedDataset('full-history')}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    selectedDataset === 'full-history' ? 'text-primary' : 'text-text group-hover:text-primary'
                  }`}
                >
                  Full history incl. corrections
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    selectedDataset === 'full-history' ? 'text-primary' : 'text-text-disabled'
                  }`}
                >
                  {selectedDataset === 'full-history' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Complete ledger including active and superseded entries, version numbers, modification reasons, and correction trails.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-text-muted border-t border-border">
              <span className="bg-surface px-2 py-0.5 rounded text-[11px] border border-border">Full Audit</span>
              <span>Revision History</span>
            </div>
          </div>

          {/* Dataset 4: Current status */}
          <div
            className={`cursor-pointer p-4 rounded-lg shadow-xs transition-all duration-150 flex flex-col justify-between group border ${
              selectedDataset === 'current-status'
                ? 'bg-primary-soft border-primary/30 ring-1 ring-primary'
                : 'bg-surface border-border hover:bg-slate-50'
            }`}
            onClick={() => setSelectedDataset('current-status')}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm font-semibold ${
                    selectedDataset === 'current-status' ? 'text-primary' : 'text-text group-hover:text-primary'
                  }`}
                >
                  Current status snapshot
                </span>
                <span
                  className={`material-symbols-outlined text-[20px] ${
                    selectedDataset === 'current-status' ? 'text-primary' : 'text-text-disabled'
                  }`}
                >
                  {selectedDataset === 'current-status' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Snapshot of all active batches with last completed milestone, current location, and pending stage assignments.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs text-text-muted border-t border-border">
              <span className="bg-surface px-2 py-0.5 rounded text-[11px] border border-border">Real-time</span>
              <span>Status Snapshot</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Filter Criteria Section Card */}
      <section className="bg-surface rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-semibold text-xs flex items-center justify-center">
              2
            </span>
            <h2 className="text-lg font-semibold text-text">Filter Parameters</h2>
          </div>
          <button
            className="text-xs text-primary hover:text-primary-hover font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            onClick={resetFilters}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            <span>Reset Filters</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date Range Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filter-date-range">
              Date Range
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-slate-100 text-text text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
                id="filter-date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="This Month">This Month</option>
                <option value="All Time">All Time</option>
                <option value="Custom Range">Custom Range</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filter-status">
              Batch Status
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-slate-100 text-text text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="CREATED">Created</option>
                <option value="COLLECTED">Collected</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="AT_RTS">At RTS</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Route Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filter-route">
              Route
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-slate-100 text-text text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
                id="filter-route"
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
              >
                <option value="">All Routes</option>
                {routesList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} - {r.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Vehicle Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filter-vehicle">
              Assigned Vehicle
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-slate-100 text-text text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
                id="filter-vehicle"
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
              >
                <option value="">All Vehicles</option>
                {vehiclesList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_number} ({v.vehicle_type})
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Waste Type Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-muted" htmlFor="filter-waste-type">
              Waste Type
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 bg-slate-100 text-text text-sm rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
                id="filter-waste-type"
                value={wasteTypeFilter}
                onChange={(e) => setWasteTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="WET">Wet Waste</option>
                <option value="DRY">Dry Waste</option>
                <option value="HAZARDOUS">Hazardous</option>
                <option value="ELECTRONIC">E-Waste</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-text-muted pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Custom Date Range Row */}
        {dateRange === 'Custom Range' && (
          <div className="mt-4 pt-4 flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-medium text-text-muted" htmlFor="custom-start-date">
                Start Date:
              </label>
              <input
                className="h-9 px-3 bg-surface text-text text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                id="custom-start-date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[13px] font-medium text-text-muted" htmlFor="custom-end-date">
                End Date:
              </label>
              <input
                className="h-9 px-3 bg-surface text-text text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                id="custom-end-date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* 3. Export Format & Execution Section Card */}
      <section className="bg-surface rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-primary-soft text-primary font-semibold text-xs flex items-center justify-center">
              3
            </span>
            <h2 className="text-lg font-semibold text-text">File Format &amp; Download</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Format Pills */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <span className="text-[13px] font-medium text-text-muted">Output Format</span>
            <div className="flex items-center gap-3">
              <button
                className={`flex-1 flex items-center justify-center gap-2.5 h-12 px-4 rounded-lg font-medium text-sm shadow-xs transition-colors cursor-pointer ${
                  format === 'csv' ? 'bg-primary text-white' : 'bg-slate-100 text-text hover:bg-slate-200'
                }`}
                onClick={() => setFormat('csv')}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">csv</span>
                <div className="text-left">
                  <span className="block leading-none font-semibold">CSV (.csv)</span>
                  <span className={`text-[11px] block mt-0.5 ${format === 'csv' ? 'opacity-80' : 'text-text-muted'}`}>
                    Streamed comma-delimited
                  </span>
                </div>
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2.5 h-12 px-4 rounded-lg font-medium text-sm shadow-xs transition-colors cursor-pointer ${
                  format === 'xlsx' ? 'bg-primary text-white' : 'bg-slate-100 text-text hover:bg-slate-200'
                }`}
                onClick={() => setFormat('xlsx')}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">table_view</span>
                <div className="text-left">
                  <span className="block leading-none font-semibold">Excel (.xlsx)</span>
                  <span className={`text-[11px] block mt-0.5 ${format === 'xlsx' ? 'opacity-80' : 'text-text-muted'}`}>
                    Styled multi-sheet workbook
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-2.5 justify-end">
            <button
              className="w-full sm:w-auto h-11 px-4 rounded-lg bg-surface hover:bg-slate-50 text-text font-medium text-sm flex items-center justify-center gap-2 shadow-xs border border-border transition-colors cursor-pointer"
              onClick={() => setShowPreviewModal(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              <span>Preview Sample Data</span>
            </button>
            <button
              className="w-full sm:w-auto h-11 px-5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-75"
              onClick={triggerDownload}
              disabled={downloading}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">
                {downloading ? 'progress_activity' : 'download'}
              </span>
              <span>{downloading ? 'Streaming Export...' : 'Download Export'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal: Sample Data Preview */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] border border-border animate-fade-in">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">table_rows</span>
                <h3 className="text-lg font-semibold text-text">Data Preview: First 10 Batches</h3>
              </div>
              <button
                className="text-text-muted hover:text-text p-1 rounded-lg cursor-pointer"
                onClick={() => setShowPreviewModal(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {/* Modal Body */}
            <div className="p-6 overflow-x-auto flex-1">
              <div className="mb-3 flex items-center justify-between text-xs text-text-muted">
                <span>Displaying live batches matching your active filter criteria.</span>
                <span className="bg-badge-completed-bg text-badge-completed-text font-semibold px-2 py-0.5 rounded">
                  Live DB Records
                </span>
              </div>
              {previewLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                  <span>Fetching preview...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-text-muted font-medium border-b border-border">
                      <th className="py-2.5 px-3">Batch Code</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Source Area</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-primary">{batch.batch_code}</td>
                        <td className="py-2 px-3 text-text-muted">
                          {batch.batch_date ? new Date(batch.batch_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-text">{batch.waste_type}</td>
                        <td className="py-2 px-3 text-text">{Number(batch.quantity).toLocaleString()} kg</td>
                        <td className="py-2 px-3 text-text">{batch.source_area}</td>
                        <td className="py-2 px-3">
                          <StatusBadge status={batch.current_status} />
                        </td>
                      </tr>
                    ))}
                    {previewBatches.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-text-muted">
                          No batches found matching filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-border flex items-center justify-between">
              <span className="text-xs text-text-muted">Dataset: {selectedDataset} • Format: {format.toUpperCase()}</span>
              <div className="flex items-center gap-3">
                <button
                  className="h-9 px-4 rounded-lg bg-surface text-text hover:bg-slate-100 text-sm font-medium border border-border shadow-xs transition-colors cursor-pointer"
                  onClick={() => setShowPreviewModal(false)}
                  type="button"
                >
                  Close Preview
                </button>
                <button
                  className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  onClick={() => {
                    setShowPreviewModal(false);
                    triggerDownload();
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
