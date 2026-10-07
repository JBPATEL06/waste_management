import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { batchesApi } from '../api/batchesApi';
import { masterApi } from '../api/masterApi';
import { usersApi } from '../api/usersApi';
import { getPublicBaseUrl } from '../utils/url';
import { printBatchManifest } from '../utils/printManifest';
import { useToast } from '../components/Toast';
import { LoadingButton } from '../components/LoadingButton';

export default function CreateBatch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const qrRef = useRef(null);

  // Form inputs
  const todayStr = new Date().toISOString().slice(0, 10);
  const [batchDate, setBatchDate] = useState(todayStr);
  const [wasteType, setWasteType] = useState('WET');
  const [quantity, setQuantity] = useState('');
  const [sourceArea, setSourceArea] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  // 4 stage assignees
  const [colUser, setColUser] = useState('');
  const [trnUser, setTrnUser] = useState('');
  const [rtsUser, setRtsUser] = useState('');
  const [prcUser, setPrcUser] = useState('');

  // Form error state
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Created batch state (success dialog)
  const [createdBatch, setCreatedBatch] = useState(null);

  // Query masters and users
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['masters', 'routes', { is_active: true }],
    queryFn: () => masterApi.getItems('routes', { is_active: true }),
  });

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['masters', 'vehicles', { is_active: true }],
    queryFn: () => masterApi.getItems('vehicles', { is_active: true }),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['masters', 'users', { is_active: true }],
    queryFn: () => usersApi.getUsers({ is_active: true }),
  });

  const routes = routesData?.items || [];
  const vehicles = vehiclesData?.items || [];
  const users = (usersData?.users || []).filter((u) => u.is_active !== false);

  const collectionUsers = users.filter((u) => u.role === 'COLLECTION');
  const transportUsers = users.filter((u) => u.role === 'TRANSPORTATION');
  const rtsUsers = users.filter((u) => u.role === 'RTS');
  const processUsers = users.filter((u) => u.role === 'PROCESSING');

  // Pre-select defaults when lists load
  useEffect(() => {
    if (!routeId && routes.length > 0) setRouteId(routes[0].id);
    if (!vehicleId && vehicles.length > 0) setVehicleId(vehicles[0].id);
    if (!colUser && collectionUsers.length > 0) setColUser(collectionUsers[0].id);
    if (!trnUser && transportUsers.length > 0) setTrnUser(transportUsers[0].id);
    if (!rtsUser && rtsUsers.length > 0) setRtsUser(rtsUsers[0].id);
    if (!prcUser && processUsers.length > 0) setPrcUser(processUsers[0].id);
  }, [routes, vehicles, collectionUsers, transportUsers, rtsUsers, processUsers]);

  const toast = useToast();

  const createBatchMutation = useMutation({
    mutationFn: (data) => batchesApi.createBatch(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['batchesList'] });
      setCreatedBatch(res.batch);
      setFieldErrors({});
      toast.success('Batch created successfully.');
    },
    onError: (err) => {
      const fieldErrs = err.fieldErrors || err.details?.fieldErrors || {};
      setFieldErrors(fieldErrs);
      let errMsg = err.message || 'Failed to create batch';
      if ((err.status === 422 || err.code === 'VALIDATION_FAILED') && Object.keys(fieldErrs).length > 0) {
        errMsg = Object.entries(fieldErrs)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }
      toast.error(errMsg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFieldErrors({});

    const payload = {
      batch_date: batchDate,
      waste_type: wasteType,
      quantity: parseFloat(quantity),
      source_area: sourceArea.trim(),
      route_id: routeId,
      vehicle_id: vehicleId,
      assignments: {
        collection_user_id: colUser,
        transportation_user_id: trnUser,
        rts_user_id: rtsUser,
        processing_user_id: prcUser,
      },
    };

    createBatchMutation.mutate(payload);
  };

  const publicBase = getPublicBaseUrl();
  const trackingUrl = createdBatch
    ? `${publicBase}/track/${createdBatch.batch_code}`
    : '';

  const downloadQrPng = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `QR_${createdBatch?.batch_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    printBatchManifest({
      batch: createdBatch,
      qrCanvas: canvas,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1000px] w-full">
      {/* Top Breadcrumb */}
      <nav className="flex items-center gap-2 text-label font-label text-text-muted">
        <Link to="/admin/batches" className="hover:text-text transition-colors">
          Batches
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-text font-medium">Create Batch</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="font-page-title text-page-title text-text">Create New Waste Batch</h1>
        <p className="font-body text-body text-text-muted mt-1">
          Generate a new batch tracking identifier, specify collection parameters, and assign stage officers.
        </p>
      </div>

      {/* Operational Rule */}
      <div className="rounded-lg bg-warning-soft px-4 py-2.5 flex items-center justify-between text-warning border border-warning/30">
        <div className="flex items-center gap-2 text-caption font-caption text-[#854d0e]">
          <span className="material-symbols-outlined text-[18px] text-warning">info</span>
          <span>
            <strong>Operational Rule:</strong> Initial status is automatically set to Created. Batch ID and system datetime are auto-generated upon submission. All four stage officers must be assigned.
          </span>
        </div>
      </div>

      {/* Form or Success State */}
      {!createdBatch ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* SECTION 1: Batch Identification & Waste Details */}
          <div className="bg-surface rounded-xl p-5 md:p-6 shadow-xs border border-border flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-soft text-primary font-section-title text-sm">
                1
              </span>
              <div>
                <h2 className="text-section-title font-section-title text-text">Batch Details &amp; Origin</h2>
                <p className="text-caption font-caption text-text-muted">General metadata and collection parameters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Collection Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-label font-label text-text-muted" htmlFor="batchDate">
                  Batch Generation Date <span className="text-error">*</span>
                </label>
                <input
                  id="batchDate"
                  type="date"
                  required
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Estimated Quantity */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-label font-label text-text-muted" htmlFor="quantity">
                    Estimated Quantity (kg) <span className="text-error">*</span>
                  </label>
                  <span className="text-caption font-caption text-primary font-medium">Weight in KG</span>
                </div>
                <div className="relative">
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    max="50000"
                    step="0.1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 2450"
                    className="w-full h-10 pl-3 pr-10 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-caption font-caption text-text-disabled">KG</span>
                </div>
                {fieldErrors.quantity && (
                  <span className="text-xs text-error">{fieldErrors.quantity}</span>
                )}
              </div>
            </div>

            {/* Waste Classification Radios */}
            <div className="flex flex-col gap-2">
              <label className="text-label font-label text-text-muted">
                Waste Classification <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setWasteType('WET')}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                    wasteType === 'WET'
                      ? 'border-primary bg-primary-soft/30'
                      : 'border-border bg-surface hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="wasteType"
                    checked={wasteType === 'WET'}
                    onChange={() => setWasteType('WET')}
                    className="mt-0.5 text-primary"
                  />
                  <div className="flex flex-col">
                    <span className="font-body-medium text-body-medium text-text flex items-center gap-1.5 font-medium">
                      Wet Waste
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                    </span>
                    <span className="font-caption text-caption text-text-muted mt-0.5">
                      Biodegradable, compostable market &amp; organic food fractions
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setWasteType('DRY')}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                    wasteType === 'DRY'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-border bg-surface hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="wasteType"
                    checked={wasteType === 'DRY'}
                    onChange={() => setWasteType('DRY')}
                    className="mt-0.5 text-blue-600"
                  />
                  <div className="flex flex-col">
                    <span className="font-body-medium text-body-medium text-text flex items-center gap-1.5 font-medium">
                      Dry Waste
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    </span>
                    <span className="font-caption text-caption text-text-muted mt-0.5">
                      Recyclables, cardboard, post-consumer polymers &amp; RDF
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Source Area */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label font-label text-text-muted" htmlFor="sourceArea">
                Source / Origin Area <span className="text-error">*</span>
              </label>
              <input
                id="sourceArea"
                type="text"
                required
                placeholder="Specific ward, community bin, or commercial zone"
                value={sourceArea}
                onChange={(e) => setSourceArea(e.target.value)}
                className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {fieldErrors.source_area && (
                <span className="text-xs text-error">{fieldErrors.source_area}</span>
              )}
            </div>

            {/* Route & Vehicle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-label font-label text-text-muted" htmlFor="route">
                  Assigned Route <span className="text-error">*</span>
                </label>
                <select
                  id="route"
                  required
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {routesLoading && <option value="" disabled>Loading...</option>}
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}: {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label font-label text-text-muted" htmlFor="vehicle">
                  Collection Vehicle <span className="text-error">*</span>
                </label>
                <select
                  id="vehicle"
                  required
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                >
                  {vehiclesLoading && <option value="" disabled>Loading...</option>}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} — {v.vehicle_type} ({v.capacity_kg} kg)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Stage Personnel Assignment */}
          <div className="bg-surface rounded-xl p-5 md:p-6 shadow-xs border border-border flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-soft text-primary font-section-title text-sm">
                  2
                </span>
                <div>
                  <h2 className="text-section-title font-section-title text-text">Stage Personnel Assignment</h2>
                  <p className="text-caption text-caption text-text-muted">
                    Assign authorized officers for each stage of the custody chain
                  </p>
                </div>
              </div>
              <span className="text-caption font-caption text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                All 4 Stages Mandatory
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage 1: Collection */}
              <div className="bg-slate-50 rounded-xl p-4 border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                    Stage 1: Collection
                  </span>
                  <span className="text-xs text-text-disabled">First Handover</span>
                </div>
                <label className="text-label font-label text-text" htmlFor="colUserSelect">
                  Collection Officer
                </label>
                <select
                  id="colUserSelect"
                  required
                  value={colUser}
                  onChange={(e) => setColUser(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {usersLoading && <option value="" disabled>Loading...</option>}
                  {collectionUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage 2: Transportation */}
              <div className="bg-slate-50 rounded-xl p-4 border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Stage 2: Transportation
                  </span>
                  <span className="text-xs text-text-disabled">Logistics Transfer</span>
                </div>
                <label className="text-label font-label text-text" htmlFor="trnUserSelect">
                  Transportation Operator
                </label>
                <select
                  id="trnUserSelect"
                  required
                  value={trnUser}
                  onChange={(e) => setTrnUser(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {usersLoading && <option value="" disabled>Loading...</option>}
                  {transportUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage 3: RTS */}
              <div className="bg-slate-50 rounded-xl p-4 border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    Stage 3: RTS Inspection
                  </span>
                  <span className="text-xs text-text-disabled">Custody Intake</span>
                </div>
                <label className="text-label font-label text-text" htmlFor="rtsUserSelect">
                  RTS Intake Supervisor
                </label>
                <select
                  id="rtsUserSelect"
                  required
                  value={rtsUser}
                  onChange={(e) => setRtsUser(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {usersLoading && <option value="" disabled>Loading...</option>}
                  {rtsUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage 4: Processing */}
              <div className="bg-slate-50 rounded-xl p-4 border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                    Stage 4: Processing
                  </span>
                  <span className="text-xs text-text-disabled">Terminal Digestion</span>
                </div>
                <label className="text-label font-label text-text" htmlFor="prcUserSelect">
                  Processing Operator
                </label>
                <select
                  id="prcUserSelect"
                  required
                  value={prcUser}
                  onChange={(e) => setPrcUser(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {usersLoading && <option value="" disabled>Loading...</option>}
                  {processUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Link
              to="/admin/batches"
              className="h-10 px-4 bg-surface border border-border text-text rounded-lg font-body-medium text-body-medium hover:bg-background transition-colors flex items-center justify-center text-center cursor-pointer"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              loading={createBatchMutation.isPending}
              loadingText="Generating..."
              className="h-10 px-5 bg-primary hover:bg-primary-hover text-on-primary rounded-lg font-body-medium text-body-medium transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-75"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code</span>
              <span>Save &amp; Generate QR</span>
            </LoadingButton>
          </div>
        </form>
      ) : (
        /* SUCCESS SCREEN (Batch created + QR display) */
        <div className="bg-surface rounded-xl border border-border p-6 shadow-xs flex flex-col items-center gap-6 text-center max-w-[600px] mx-auto w-full animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">check_circle</span>
          </div>

          <div>
            <span className="font-badge text-badge px-2.5 py-0.5 rounded-full bg-badge-created-bg text-badge-created-text border border-border">
              Created Successfully
            </span>
            <h2 className="font-page-title text-page-title text-text mt-2 font-mono">
              {createdBatch.batch_code}
            </h2>
            <p className="font-caption text-caption text-text-muted mt-1">
              {createdBatch.source_area} • {Number(createdBatch.quantity).toLocaleString()} kg • {createdBatch.waste_type} Waste
            </p>
          </div>

          {/* QR Code Container */}
          <div
            ref={qrRef}
            className="p-4 bg-white border border-border rounded-xl shadow-xs flex flex-col items-center gap-3"
          >
            <QRCodeCanvas value={trackingUrl} size={160} level="M" />
            <span className="font-mono text-xs font-semibold text-text tracking-wider">
              {createdBatch.batch_code}
            </span>
          </div>

          {/* QR Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              type="button"
              className="h-10 px-4 bg-surface border border-border text-text font-body-medium text-sm rounded-lg hover:bg-background transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print Manifest</span>
            </button>
            <button
              onClick={downloadQrPng}
              type="button"
              className="h-10 px-4 bg-surface border border-border text-text font-body-medium text-sm rounded-lg hover:bg-background transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Download PNG</span>
            </button>
          </div>

          <div className="w-full pt-4 border-t border-border flex items-center justify-between">
            <button
              onClick={() => {
                setCreatedBatch(null);
                setQuantity('');
                setSourceArea('');
              }}
              className="text-sm font-medium text-text-muted hover:text-text cursor-pointer"
            >
              + Create Another Batch
            </button>

            <button
              onClick={() => navigate(`/admin/batches/${createdBatch.batch_code}`)}
              className="h-10 px-5 bg-primary text-white hover:bg-primary-hover rounded-lg font-medium transition-colors shadow-xs cursor-pointer"
            >
              Open Batch Details →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
