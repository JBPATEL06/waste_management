import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STAGE_CONFIG } from '../../constants/stages';
import { batchesApi } from '../../api/batchesApi';
import { entriesApi } from '../../api/entriesApi';
import { masterApi } from '../../api/masterApi';
import { settingsApi } from '../../api/settingsApi';

export default function StageEntryForm({ role: propRole }) {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Resolve role config
  let roleKey = propRole;
  if (!roleKey) {
    if (location.pathname.startsWith('/transportation')) roleKey = 'transportation';
    else if (location.pathname.startsWith('/rts')) roleKey = 'rts';
    else if (location.pathname.startsWith('/processing')) roleKey = 'processing';
    else roleKey = 'collection';
  }

  const cfg = STAGE_CONFIG[roleKey] || STAGE_CONFIG.collection;

  // Mode state: 'new' or 'correction'
  const initialMode = searchParams.get('mode') === 'correction' ? 'correction' : 'new';
  const [mode, setMode] = useState(initialMode);
  const isCorrection = mode === 'correction';

  // Fetch real batch details
  const {
    data: batchData,
    isLoading: isBatchLoading,
    isError: isBatchError,
    error: batchError,
  } = useQuery({
    queryKey: ['stageEntryBatch', code],
    queryFn: () => batchesApi.getBatch(code),
    enabled: Boolean(code),
  });

  const batch = batchData?.batch;
  const timeline = batchData?.timeline || [];

  const ownStageEntry = useMemo(() => {
    return timeline.find((e) => e.stage === cfg.roleKey && e.status === 'ACTIVE');
  }, [timeline, cfg.roleKey]);

  // Master lists
  const { data: routesData } = useQuery({
    queryKey: ['masters', 'routes'],
    queryFn: () => masterApi.getRoutes(),
    enabled: cfg.stageNumber === 1,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['masters', 'vehicles'],
    queryFn: () => masterApi.getVehicles(),
    enabled: cfg.stageNumber <= 2,
  });

  const { data: driversData } = useQuery({
    queryKey: ['masters', 'drivers'],
    queryFn: () => masterApi.getDrivers(),
    enabled: cfg.stageNumber === 1,
  });

  const { data: rtsData } = useQuery({
    queryKey: ['masters', 'rts_locations'],
    queryFn: () => masterApi.getRtsLocations(),
    enabled: cfg.stageNumber === 2 || cfg.stageNumber === 3,
  });

  const { data: wasteCategoriesData } = useQuery({
    queryKey: ['masters', 'waste_categories'],
    queryFn: () => masterApi.getWasteCategories(),
    enabled: cfg.stageNumber === 3,
  });

  const { data: facilitiesData } = useQuery({
    queryKey: ['masters', 'processing_facilities'],
    queryFn: () => masterApi.getProcessingFacilities(),
    enabled: cfg.stageNumber === 3 || cfg.stageNumber === 4,
  });

  const { data: processTypesData } = useQuery({
    queryKey: ['masters', 'process_types'],
    queryFn: () => masterApi.getProcessTypes(),
    enabled: cfg.stageNumber === 4,
  });

  const { data: settingsData } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => settingsApi.getSettings(),
  });

  const varianceThreshold = Number(settingsData?.variance_threshold_pct || 10);

  // Today's default dates
  const todayStr = new Date().toISOString().split('T')[0];
  const nowTimeStr = new Date().toTimeString().slice(0, 5);

  // Common Form Fields
  const [collectionDate, setCollectionDate] = useState(todayStr);
  const [collectionTime, setCollectionTime] = useState(nowTimeStr);
  const [remarks, setRemarks] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Collection Stage Fields
  const [collectionArea, setCollectionArea] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [wasteType, setWasteType] = useState('WET');
  const [collectionWeight, setCollectionWeight] = useState('');

  // Transportation Stage Fields
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [transportRtsId, setTransportRtsId] = useState('');
  const [transportVehicleId, setTransportVehicleId] = useState('');
  const [departureDate, setDepartureDate] = useState(todayStr);
  const [departureTime, setDepartureTime] = useState(nowTimeStr);
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

  // RTS Stage Fields
  const [rtsLocationId, setRtsLocationId] = useState('');
  const [rtsReceivedWeight, setRtsReceivedWeight] = useState('');
  const [wasteCategoryId, setWasteCategoryId] = useState('');
  const [handoverDetails, setHandoverDetails] = useState('');
  const [nextFacilityId, setNextFacilityId] = useState('');

  // Processing Stage Fields
  const [processingFacilityId, setProcessingFacilityId] = useState('');
  const [processTypeId, setProcessTypeId] = useState('');
  const [processedWeight, setProcessedWeight] = useState('');
  const [finalStatus, setFinalStatus] = useState('COMPLETED');

  // Prefill state from loaded batch and masters
  useEffect(() => {
    if (batch) {
      if (cfg.stageNumber === 1) {
        setCollectionArea(batch.source_area || '');
        setRouteId(batch.route_id || '');
        setVehicleId(batch.vehicle_id || '');
        setWasteType(batch.waste_type || 'WET');
        setCollectionWeight(batch.quantity || '');
      } else if (cfg.stageNumber === 2) {
        setStartLocation(batch.source_area || '');
        setTransportVehicleId(batch.vehicle_id || '');
        setDestination('Central RTS');
      } else if (cfg.stageNumber === 3) {
        setRtsReceivedWeight(batch.quantity || '');
        setHandoverDetails(`Handover of batch ${batch.batch_code} at RTS`);
      } else if (cfg.stageNumber === 4) {
        setProcessedWeight(batch.quantity || '');
      }
    }
  }, [batch, cfg.stageNumber]);

  // Set default dropdown selections when data loads
  useEffect(() => {
    if (driversData?.items?.length > 0 && !driverId) {
      setDriverId(driversData.items[0].id);
    }
    if (rtsData?.items?.length > 0) {
      if (!transportRtsId) setTransportRtsId(rtsData.items[0].id);
      if (!rtsLocationId) setRtsLocationId(rtsData.items[0].id);
    }
    if (wasteCategoriesData?.items?.length > 0 && !wasteCategoryId) {
      setWasteCategoryId(wasteCategoriesData.items[0].id);
    }
    if (facilitiesData?.items?.length > 0) {
      if (!nextFacilityId) setNextFacilityId(facilitiesData.items[0].id);
      if (!processingFacilityId) setProcessingFacilityId(facilitiesData.items[0].id);
    }
    if (processTypesData?.items?.length > 0 && !processTypeId) {
      setProcessTypeId(processTypesData.items[0].id);
    }
  }, [
    driversData,
    rtsData,
    wasteCategoriesData,
    facilitiesData,
    processTypesData,
    driverId,
    transportRtsId,
    rtsLocationId,
    wasteCategoryId,
    nextFacilityId,
    processingFacilityId,
    processTypeId,
  ]);

  // Submission state
  const [submittedMessage, setSubmittedMessage] = useState(null);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Live Variance for RTS
  const liveVariance = useMemo(() => {
    if (cfg.stageNumber !== 3 || !batch?.quantity) return null;
    const base = Number(batch.quantity);
    const entered = Number(rtsReceivedWeight);
    if (!entered || isNaN(entered)) return null;
    const diff = Number((entered - base).toFixed(2));
    const pct = Number(((diff / base) * 100).toFixed(2));
    return {
      diff,
      pct,
      isFlagged: Math.abs(pct) > varianceThreshold,
    };
  }, [rtsReceivedWeight, batch?.quantity, cfg.stageNumber, varianceThreshold]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload) => entriesApi.createEntry(batch.id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stageQueue'] });
      queryClient.invalidateQueries({ queryKey: ['stageBatchView', code] });
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
      setSubmittedMessage(`Manifest entry successfully committed for batch ${batch.batch_code}.`);
      setTimeout(() => {
        navigate(`${cfg.prefix}/batches/${batch.batch_code}`);
      }, 1500);
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to submit stage entry');
      if (err.details && Array.isArray(err.details)) {
        const errors = {};
        err.details.forEach((d) => {
          if (d.path) errors[d.path.join('.')] = d.message;
        });
        setFieldErrors(errors);
      }
    },
  });

  const correctMutation = useMutation({
    mutationFn: (payload) => entriesApi.correctEntry(ownStageEntry.id, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stageQueue'] });
      queryClient.invalidateQueries({ queryKey: ['stageBatchView', code] });
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
      setSubmittedMessage(`Corrected manifest entry for ${batch.batch_code} committed to audit trail.`);
      setTimeout(() => {
        navigate(`${cfg.prefix}/batches/${batch.batch_code}`);
      }, 1500);
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to submit correction');
      if (err.details && Array.isArray(err.details)) {
        const errors = {};
        err.details.forEach((d) => {
          if (d.path) errors[d.path.join('.')] = d.message;
        });
        setFieldErrors(errors);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (isCorrection) {
      if (!ownStageEntry) {
        setFormError('Cannot submit a correction: No prior active entry exists for this stage.');
        return;
      }
      if (!correctionReason.trim() || correctionReason.trim().length < 3) {
        setFormError('Correction reason is mandatory (minimum 3 characters).');
        return;
      }
    }

    // Build event timestamp ISO
    const dateTimeStr = `${collectionDate}T${collectionTime}:00`;
    let eventTimeIso;
    try {
      eventTimeIso = new Date(dateTimeStr).toISOString();
    } catch {
      eventTimeIso = new Date().toISOString();
    }

    let payload = {};

    if (cfg.stageNumber === 1) {
      // Collection
      payload = {
        event_time: eventTimeIso,
        collection_area: collectionArea.trim(),
        route_id: routeId,
        vehicle_id: vehicleId,
        driver_id: driverId,
        waste_type: wasteType,
        quantity: Number(collectionWeight),
        note: remarks ? remarks.trim() : null,
      };
    } else if (cfg.stageNumber === 2) {
      // Transportation
      const depIso = new Date(`${departureDate}T${departureTime}:00`).toISOString();
      let arrIso = null;
      if (arrivalDate && arrivalTime) {
        arrIso = new Date(`${arrivalDate}T${arrivalTime}:00`).toISOString();
      }
      payload = {
        event_time: depIso,
        start_location: startLocation.trim(),
        destination: destination.trim(),
        rts_location_id: transportRtsId,
        vehicle_id: transportVehicleId,
        arrival_time: arrIso,
        note: remarks ? remarks.trim() : null,
      };
    } else if (cfg.stageNumber === 3) {
      // RTS
      payload = {
        event_time: eventTimeIso,
        rts_location_id: rtsLocationId,
        quantity_received: Number(rtsReceivedWeight),
        waste_category_id: wasteCategoryId,
        handover_details: handoverDetails.trim(),
        next_facility_id: nextFacilityId,
        note: remarks ? remarks.trim() : null,
      };
    } else if (cfg.stageNumber === 4) {
      // Processing
      payload = {
        event_time: eventTimeIso,
        facility_id: processingFacilityId,
        process_type_id: processTypeId,
        quantity: Number(processedWeight),
        final_status: finalStatus,
        note: remarks ? remarks.trim() : null,
      };
    }

    if (isCorrection) {
      payload.reason = correctionReason.trim();
      correctMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isBatchLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">
          progress_activity
        </span>
        <span className="text-sm font-medium">Loading batch parameters...</span>
      </div>
    );
  }

  if (isBatchError || !batch) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-error-soft text-error flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">search_off</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Batch Not Found</h2>
          <p className="text-sm text-text-muted mt-1">{batchError?.message || `No batch matches code "${code}"`}</p>
        </div>
        <Link
          to={`${cfg.prefix}/dashboard`}
          className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover"
        >
          Back to Queue
        </Link>
      </div>
    );
  }

  const isSubmitting = createMutation.isPending || correctMutation.isPending;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <nav className="flex items-center gap-2 text-caption font-caption text-text-muted">
            <Link to={`${cfg.prefix}/dashboard`} className="hover:text-text transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link to={`${cfg.prefix}/batches/${batch.batch_code}`} className="hover:text-text transition-colors">
              Batches
            </Link>
            <span>/</span>
            <span className="font-body-medium text-text">{batch.batch_code}</span>
            <span>/</span>
            <span className="text-text-disabled">{cfg.roleLabel} Entry</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
            <h1 className="font-page-title text-page-title text-text">
              Log {cfg.roleLabel} Manifest
            </h1>
            <span className="font-batch-id text-batch-id bg-surface border border-border px-2.5 py-0.5 rounded text-text font-mono">
              {batch.batch_code}
            </span>
            <span
              id="modeBadge"
              className={`font-badge text-badge px-2.5 py-0.5 rounded-full font-medium ${
                isCorrection
                  ? 'bg-warning-soft text-badge-transit-text'
                  : 'bg-badge-collected-bg text-badge-collected-text'
              }`}
            >
              Mode: {isCorrection ? 'Correction' : 'New Entry'}
            </span>
          </div>
        </div>

        <Link
          to={`${cfg.prefix}/batches/${batch.batch_code}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 h-10 rounded-lg bg-surface border border-border font-body-medium text-body-medium text-text hover:bg-background transition-colors self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Batch View</span>
        </Link>
      </div>

      {/* Success Banner */}
      {submittedMessage && (
        <div className="bg-primary-soft border border-primary-container/30 text-primary-container p-4 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px]">task_alt</span>
          <span className="font-body-medium text-body-medium font-medium">{submittedMessage}</span>
        </div>
      )}

      {/* Form Error Banner */}
      {formError && (
        <div className="bg-error-soft border border-error/30 text-error p-4 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px]">error</span>
          <span className="font-body-medium text-body-medium">{formError}</span>
        </div>
      )}

      {/* Read-Only Batch Reference Specification Card */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">assignment</span>
            <span className="font-section-title text-section-title text-text">Batch Parameters</span>
          </div>
          <span className="font-caption text-caption text-text-muted">
            Status: {batch.current_status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          <div>
            <span className="block font-label text-label text-text-muted">Origin / Area</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block truncate" title={batch.source_area}>
              {batch.source_area || '—'}
            </span>
          </div>

          <div>
            <span className="block font-label text-label text-text-muted">Assigned Route</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block truncate" title={batch.route_name}>
              {batch.route_name || '—'}
            </span>
          </div>

          <div>
            <span className="block font-label text-label text-text-muted">Vehicle Details</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block truncate" title={batch.vehicle_number}>
              {batch.vehicle_number || '—'}
            </span>
          </div>

          <div>
            <span className="block font-label text-label text-text-muted">Waste Type &amp; Initial Qty</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block">
              {batch.waste_type} • {Number(batch.quantity).toLocaleString()} kg
            </span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-surface border border-border rounded-lg text-body text-text shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-text-muted text-[18px]">rule</span>
          <span className="font-body-medium text-body-medium">Entry Operation Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btnModeNew"
            onClick={() => setMode('new')}
            className={`px-3 py-1 rounded font-label text-label transition-colors cursor-pointer ${
              !isCorrection
                ? 'bg-primary-soft text-primary-container font-medium border border-primary-container/20'
                : 'text-text-muted hover:text-text hover:bg-background border border-transparent'
            }`}
          >
            Initial Entry
          </button>
          <button
            type="button"
            id="btnModeCorrection"
            onClick={() => setMode('correction')}
            className={`px-3 py-1 rounded font-label text-label transition-colors cursor-pointer ${
              isCorrection
                ? 'bg-warning-soft text-warning font-medium border border-warning/30'
                : 'text-text-muted hover:text-text hover:bg-background border border-transparent'
            }`}
          >
            Correction / Amendment
          </button>
        </div>
      </div>

      {/* Form Container */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6"
      >
        {/* Stage 1: COLLECTION FIELDS */}
        {cfg.stageNumber === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-label text-label text-text-muted flex items-center justify-between">
                <span>Collection Area / Pickup Location <span className="text-error">*</span></span>
              </label>
              <input
                required
                type="text"
                value={collectionArea}
                onChange={(e) => setCollectionArea(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
              {fieldErrors['collection_area'] && (
                <span className="text-xs text-error">{fieldErrors['collection_area']}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Assigned Route <span className="text-error">*</span></label>
              <select
                required
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Route</option>
                {(routesData?.items || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Vehicle <span className="text-error">*</span></label>
              <select
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Vehicle</option>
                {(vehiclesData?.items || []).map((v) => (
                  <option key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Driver In-Charge <span className="text-error">*</span></label>
              <select
                required
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Driver</option>
                {(driversData?.items || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Waste Type <span className="text-error">*</span></label>
              <select
                required
                value={wasteType}
                onChange={(e) => setWasteType(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="WET">Wet Organic Waste</option>
                <option value="DRY">Dry Recyclable Waste</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-label text-label text-text-muted">Net Collected Weight (kg) <span className="text-error">*</span></label>
              <input
                required
                min="1"
                step="0.5"
                type="number"
                value={collectionWeight}
                onChange={(e) => setCollectionWeight(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
              {fieldErrors['quantity'] && (
                <span className="text-xs text-error">{fieldErrors['quantity']}</span>
              )}
            </div>
          </div>
        )}

        {/* Stage 2: TRANSPORTATION FIELDS */}
        {cfg.stageNumber === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Start Location <span className="text-error">*</span></label>
              <input
                required
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Destination Location <span className="text-error">*</span></label>
              <input
                required
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Target RTS Facility <span className="text-error">*</span></label>
              <select
                required
                value={transportRtsId}
                onChange={(e) => setTransportRtsId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select RTS Facility</option>
                {(rtsData?.items || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Vehicle Assigned <span className="text-error">*</span></label>
              <select
                required
                value={transportVehicleId}
                onChange={(e) => setTransportVehicleId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Vehicle</option>
                {(vehiclesData?.items || []).map((v) => (
                  <option key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Departure Date &amp; Time (IST) <span className="text-error">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                />
                <input
                  required
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Arrival Date &amp; Time (IST) <span className="text-xs text-text-disabled">(Optional if in-transit)</span></label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                />
                <input
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
                />
              </div>
            </div>
          </div>
        )}

        {/* Stage 3: RTS FIELDS */}
        {cfg.stageNumber === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">RTS Intake Station <span className="text-error">*</span></label>
              <select
                required
                value={rtsLocationId}
                onChange={(e) => setRtsLocationId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select RTS Station</option>
                {(rtsData?.items || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Waste Category <span className="text-error">*</span></label>
              <select
                required
                value={wasteCategoryId}
                onChange={(e) => setWasteCategoryId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Category</option>
                {(wasteCategoriesData?.items || []).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">RTS Weighed Received Weight (kg) <span className="text-error">*</span></label>
              <input
                required
                min="1"
                step="0.5"
                type="number"
                value={rtsReceivedWeight}
                onChange={(e) => setRtsReceivedWeight(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Next Processing Facility <span className="text-error">*</span></label>
              <select
                required
                value={nextFacilityId}
                onChange={(e) => setNextFacilityId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Target Facility</option>
                {(facilitiesData?.items || []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-label text-label text-text-muted">Handover Details <span className="text-error">*</span></label>
              <input
                required
                type="text"
                value={handoverDetails}
                onChange={(e) => setHandoverDetails(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            {/* RTS Live Variance Box */}
            {liveVariance && (
              <div
                className={`md:col-span-2 flex flex-col gap-1 p-3.5 rounded-lg border ${
                  liveVariance.isFlagged
                    ? 'bg-error-soft/30 border-error/30 text-error'
                    : 'bg-primary-soft/30 border-primary/20 text-primary-container'
                }`}
              >
                <span className="font-body-medium text-body-medium font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">
                    {liveVariance.isFlagged ? 'warning' : 'check_circle'}
                  </span>
                  Weighbridge Variance: {liveVariance.pct > 0 ? `+${liveVariance.pct}` : liveVariance.pct}% (
                  {liveVariance.diff > 0 ? `+${liveVariance.diff}` : liveVariance.diff} kg discrepancy)
                </span>
                <span className="font-caption text-caption">
                  {liveVariance.isFlagged
                    ? `Warning: Discrepancy exceeds configured threshold (${varianceThreshold}%). Batch will be flagged for administrative audit upon submission.`
                    : `Discrepancy is within safe operational limit (threshold: ${varianceThreshold}%).`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Stage 4: PROCESSING FIELDS */}
        {cfg.stageNumber === 4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Processing Facility <span className="text-error">*</span></label>
              <select
                required
                value={processingFacilityId}
                onChange={(e) => setProcessingFacilityId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Facility</option>
                {(facilitiesData?.items || []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Treatment Process Type <span className="text-error">*</span></label>
              <select
                required
                value={processTypeId}
                onChange={(e) => setProcessTypeId(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="">Select Process Type</option>
                {(processTypesData?.items || []).map((pt) => (
                  <option key={pt.id} value={pt.id}>{pt.name} ({pt.code})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Quantity Processed (kg) <span className="text-error">*</span></label>
              <input
                required
                min="1"
                step="0.5"
                type="number"
                value={processedWeight}
                onChange={(e) => setProcessedWeight(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Final Disposition Status <span className="text-error">*</span></label>
              <select
                required
                value={finalStatus}
                onChange={(e) => setFinalStatus(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              >
                <option value="COMPLETED">COMPLETED (Journey Closed)</option>
                <option value="PROCESSED">PROCESSED (Finished)</option>
                <option value="RECOVERED">RECOVERED (Recycled)</option>
                <option value="DISPOSED">DISPOSED (Safe Landfill)</option>
              </select>
            </div>
          </div>
        )}

        {/* Common Date & Time (for Stages 1, 3, 4) */}
        {cfg.stageNumber !== 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-border">
            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Operation Date <span className="text-error">*</span></label>
              <input
                required
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label text-label text-text-muted">Exact Timestamp (IST) <span className="text-error">*</span></label>
              <input
                required
                type="time"
                value={collectionTime}
                onChange={(e) => setCollectionTime(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
          </div>
        )}

        {/* Common Remarks */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
          <label className="font-label text-label text-text-muted flex items-center justify-between">
            <span>Operational Remarks / Notes</span>
            <span className="font-caption text-caption text-text-disabled">Optional</span>
          </label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional notes regarding physical conditions, scale calibration, or transit handoffs..."
            className="p-3 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>

        {/* Correction Justification Section */}
        {isCorrection && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-warning-soft/20 border border-warning/30">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-warning text-[20px] mt-0.5">warning</span>
              <div className="flex flex-col">
                <span className="font-body-medium text-body-medium text-text font-semibold">
                  Correction Mode Activated
                </span>
                <span className="font-caption text-caption text-text-muted">
                  Submitting will create version v{(ownStageEntry?.version_no || 1) + 1}.0 and mark previous record as SUPERSEDED. A mandatory justification reason is logged to the immutable audit trail.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <label className="font-label text-label text-text font-medium">
                Mandatory Reason for Correction <span className="text-error">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Specify reason for modification (e.g. Weighbridge tare recalibration, gross measurement adjustment)..."
                className="p-2.5 rounded-lg border border-border bg-surface text-body text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => navigate(`${cfg.prefix}/batches/${batch.batch_code}`)}
            className="w-full sm:w-auto h-10 px-5 rounded-lg border border-border bg-surface font-body-medium text-body-medium text-text hover:bg-background transition-colors text-center cursor-pointer"
          >
            Discard Changes
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto h-10 px-5 rounded-lg bg-primary-container hover:bg-primary-hover text-on-primary font-body-medium text-body-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
          >
            {isSubmitting ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">check</span>
            )}
            <span>
              {isSubmitting
                ? 'Submitting...'
                : isCorrection
                ? 'Submit Corrected Manifest'
                : `Submit ${cfg.roleLabel} Entry`}
            </span>
          </button>
        </div>
      </form>

      {/* Stage Audit Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-caption font-caption text-text-disabled px-2 pb-6">
        <span>Stage: {cfg.stageTitle} (Stage {cfg.stageNumber} of 4)</span>
        <span>Node Role: {cfg.roleLabel}</span>
      </div>
    </div>
  );
}
