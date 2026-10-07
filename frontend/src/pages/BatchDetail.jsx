import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { batchesApi } from '../api/batchesApi';
import { entriesApi } from '../api/entriesApi';
import { usersApi } from '../api/usersApi';
import { masterApi } from '../api/masterApi';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getPublicBaseUrl } from '../utils/url';
import { printBatchManifest } from '../utils/printManifest';
import { formatDateTime } from '../utils/formatDateTime';
import { useToast } from '../components/Toast';
import { LoadingButton } from '../components/LoadingButton';
import { formatApiError } from '../utils/formatApiError';
import { DetailSkeleton } from '../components/Skeleton';

const toDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoDateTime = (value) => (value ? new Date(value).toISOString() : '');

export default function BatchDetail() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const qrRef = useRef(null);

  const isHeadOfficer = user?.role === 'HEAD_OFFICER';
  const isAdmin = user?.role === 'ADMIN';

  // Modal dialog states
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [showDeleteEntryModal, setShowDeleteEntryModal] = useState(false);
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);
  const [deleteBatchReason, setDeleteBatchReason] = useState('');

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [reason, setReason] = useState('');

  // Reassign state
  const [reassignStage, setReassignStage] = useState('COLLECTION');
  const [newAssigneeId, setNewAssigneeId] = useState('');

  // Fetch batch details
  const {
    data: batchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['batchDetail', code],
    queryFn: () => batchesApi.getBatch(code),
    enabled: Boolean(code),
    staleTime: 15 * 1000,
  });

  const batch = batchData?.batch;
  const assignments = batchData?.assignments || [];
  const timeline = batchData?.timeline || [];
  const history = batchData?.history || [];

  // Fetch active users for reassignments
  const toast = useToast();

  const { data: usersData } = useQuery({
    queryKey: ['masters', 'users', { is_active: true }],
    queryFn: () => usersApi.getUsers({ is_active: true }),
    enabled: showReassignModal,
  });

  const { data: editRoutesData } = useQuery({
    queryKey: ['masters', 'routes'],
    queryFn: () => masterApi.getRoutes(),
    enabled: showEditEntryModal,
  });
  const { data: editVehiclesData } = useQuery({
    queryKey: ['masters', 'vehicles'],
    queryFn: () => masterApi.getVehicles(),
    enabled: showEditEntryModal,
  });
  const { data: editDriversData } = useQuery({
    queryKey: ['masters', 'drivers'],
    queryFn: () => masterApi.getDrivers(),
    enabled: showEditEntryModal,
  });
  const { data: editRtsLocationsData } = useQuery({
    queryKey: ['masters', 'rts-locations'],
    queryFn: () => masterApi.getRtsLocations(),
    enabled: showEditEntryModal,
  });
  const { data: editWasteCategoriesData } = useQuery({
    queryKey: ['masters', 'waste-categories'],
    queryFn: () => masterApi.getWasteCategories(),
    enabled: showEditEntryModal,
  });
  const { data: editFacilitiesData } = useQuery({
    queryKey: ['masters', 'processing-facilities'],
    queryFn: () => masterApi.getProcessingFacilities(),
    enabled: showEditEntryModal,
  });
  const { data: editProcessTypesData } = useQuery({
    queryKey: ['masters', 'process-types'],
    queryFn: () => masterApi.getProcessTypes(),
    enabled: showEditEntryModal,
  });

  const availableUsers = (usersData?.users || []).filter((u) => u.role === reassignStage);
  const invalidateBatchRelated = ({ includeBatchDetail = true } = {}) => {
    if (includeBatchDetail) {
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
    }
    queryClient.invalidateQueries({ queryKey: ['batchesList'] });
    queryClient.invalidateQueries({ queryKey: ['hoBatchesList'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardBreakdowns'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardPending'] });
    queryClient.invalidateQueries({ queryKey: ['dashboardRecent'] });
    queryClient.invalidateQueries({ queryKey: ['stageQueue'] });
    queryClient.invalidateQueries({ queryKey: ['operatorHistory'] });
    queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
  };

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: (payload) => batchesApi.reassignBatch(code, payload),
    onSuccess: () => {
      invalidateBatchRelated();
      setShowReassignModal(false);
      setReason('');
      setNewAssigneeId('');
      toast.success(`Reassigned ${reassignStage} operator successfully`);
    },
    onError: (err) => {
      toast.error(formatApiError(err, 'Failed to reassign user'));
    },
  });

  // Edit entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }) => entriesApi.updateEntry(id, data),
    onSuccess: () => {
      invalidateBatchRelated();
      setShowEditEntryModal(false);
      setSelectedEntry(null);
      setReason('');
      toast.success('Entry updated successfully');
    },
    onError: (err) => {
      toast.error(formatApiError(err, 'Failed to update entry'));
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: ({ id, reasonText }) => entriesApi.deleteEntry(id, reasonText),
    onSuccess: () => {
      invalidateBatchRelated();
      setShowDeleteEntryModal(false);
      setSelectedEntry(null);
      setReason('');
      toast.success('Entry deleted successfully');
    },
    onError: (err) => {
      toast.error(formatApiError(err, 'Failed to delete entry'));
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (reasonText) => batchesApi.deleteBatch(batch.id, { reason: reasonText }),
    onSuccess: () => {
      // The deleted detail query must not refetch and turn a successful delete into a 404 toast.
      invalidateBatchRelated({ includeBatchDetail: false });
      toast.success(`Batch ${batch.batch_code} deleted successfully`);
      setShowDeleteBatchModal(false);
      setTimeout(() => {
        navigate('/admin/batches');
      }, 700);
    },
    onError: (err) => {
      toast.error(formatApiError(err, 'Failed to delete batch'));
    },
  });

  const handleDeleteBatch = (e) => {
    e.preventDefault();
    if (!deleteBatchReason.trim() || deleteBatchReason.trim().length < 5) {
      toast.error('Reason must be at least 5 characters');
      return;
    }
    deleteBatchMutation.mutate(deleteBatchReason.trim());
  };

  const handleReassign = (e) => {
    e.preventDefault();
    if (!newAssigneeId) return;

    reassignMutation.mutate({
      stage: reassignStage,
      user_id: newAssigneeId,
      reason: reason.trim() || `Reassigned ${reassignStage} operator by Administrator`,
    });
  };

  const handleAdminEditEntry = (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error('Justification reason must be at least 3 characters.');
      return;
    }

    updateEntryMutation.mutate({
      id: selectedEntry.id,
      data: { ...editEntryPayload(), reason: reason.trim() },
    });
  };

  const startEditingEntry = (entry) => {
    setSelectedEntry(entry);
    setReason('');
    setEditFields({
      event_time: toDateTimeInput(entry.event_time),
      note: entry.note || '',
      collection_area: entry.collection_area || '',
      route_id: entry.collection_route_id || '',
      vehicle_id: entry.stage === 'COLLECTION'
        ? entry.collection_vehicle_id || ''
        : entry.transportation_vehicle_id || '',
      waste_type: entry.collection_waste_type || 'WET',
      quantity: entry.collection_quantity ?? '',
      driver_id: entry.driver_id || '',
      start_location: entry.start_location || '',
      destination: entry.destination || '',
      rts_location_id: entry.stage === 'RTS'
        ? entry.rts_location_id || ''
        : entry.transportation_rts_location_id || '',
      arrival_time: toDateTimeInput(entry.arrival_time),
      quantity_received: entry.quantity_received ?? '',
      waste_category_id: entry.waste_category_id || '',
      handover_details: entry.handover_details || '',
      next_facility_id: entry.next_facility_id || '',
      facility_id: entry.processing_facility_id || '',
      process_type_id: entry.process_type_id || '',
      final_status: entry.final_status || 'COMPLETED',
      processing_quantity: entry.processed_quantity ?? '',
    });
    setShowEditEntryModal(true);
  };

  const updateEditField = (field, value) => {
    setEditFields((current) => ({ ...current, [field]: value }));
  };

  const editEntryPayload = () => {
    const common = {
      event_time: toIsoDateTime(editFields.event_time),
      note: editFields.note,
    };

    if (selectedEntry.stage === 'COLLECTION') {
      return {
        ...common,
        collection_area: editFields.collection_area.trim(),
        route_id: editFields.route_id,
        vehicle_id: editFields.vehicle_id,
        waste_type: editFields.waste_type,
        quantity: Number(editFields.quantity),
        driver_id: editFields.driver_id,
      };
    }
    if (selectedEntry.stage === 'TRANSPORTATION') {
      return {
        ...common,
        start_location: editFields.start_location.trim(),
        destination: editFields.destination.trim(),
        rts_location_id: editFields.rts_location_id,
        vehicle_id: editFields.vehicle_id,
        arrival_time: toIsoDateTime(editFields.arrival_time),
      };
    }
    if (selectedEntry.stage === 'RTS') {
      return {
        ...common,
        rts_location_id: editFields.rts_location_id,
        quantity_received: Number(editFields.quantity_received),
        waste_category_id: editFields.waste_category_id,
        handover_details: editFields.handover_details.trim(),
        next_facility_id: editFields.next_facility_id,
      };
    }
    return {
      ...common,
      facility_id: editFields.facility_id,
      process_type_id: editFields.process_type_id,
      quantity: Number(editFields.processing_quantity),
      final_status: editFields.final_status,
    };
  };

  const renderEditField = (name, label, { type = 'text', options, step, min } = {}) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted" htmlFor={`edit-${name}`}>{label}</label>
      {options ? (
        <select
          id={`edit-${name}`}
          required
          disabled={updateEntryMutation.isPending}
          value={editFields[name] ?? ''}
          onChange={(e) => updateEditField(name, e.target.value)}
          className="h-10 px-3 bg-surface border border-border rounded-lg text-text text-sm disabled:opacity-75"
        >
          <option value="">Select {label}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={`edit-${name}`}
          type={type}
          required
          min={min}
          step={step}
          maxLength={name === 'note' ? 500 : undefined}
          disabled={updateEntryMutation.isPending}
          value={editFields[name] ?? ''}
          onChange={(e) => updateEditField(name, e.target.value)}
          className="h-10 px-3 bg-surface border border-border rounded-lg text-text text-sm disabled:opacity-75"
        />
      )}
    </div>
  );

  const handleConfirmDeleteEntry = (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      toast.error('Deletion reason must be at least 3 characters.');
      return;
    }

    deleteEntryMutation.mutate({
      id: selectedEntry.id,
      reasonText: reason.trim(),
    });
  };

  const downloadQrPng = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `QR_${batch?.batch_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    printBatchManifest({
      batch,
      qrCanvas: canvas,
      timeline,
      assignments,
    });
  };

  const publicBase = getPublicBaseUrl();
  const trackingUrl = batch ? `${publicBase}/track/${batch.batch_code}` : '';

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if ((isError && !batchData) || !batch) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-error-soft text-error flex items-center justify-center">
          <span className="material-symbols-outlined text-[28px]">search_off</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-text">Batch Not Found</h2>
          <p className="text-sm text-text-muted mt-1">{error?.message || `No batch matches code "${code}"`}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-surface border border-border text-sm rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Retry
          </button>
          <Link
            to={isHeadOfficer ? '/ho/batches' : '/admin/batches'}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover"
          >
            Back to Batches
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1200px]">
      {/* Top Breadcrumb */}
      <nav className="flex items-center gap-2 text-label font-label text-text-muted">
        <Link to={isHeadOfficer ? '/ho/batches' : '/admin/batches'} className="hover:text-text transition-colors">
          Batches
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-text font-semibold">{batch.batch_code}</span>
      </nav>

      {/* Header Info Card */}
      <div className="bg-surface rounded-xl border border-border p-5 md:p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-batch-id text-2xl md:text-3xl font-bold text-text">{batch.batch_code}</h1>
              <StatusBadge status={batch.current_status} />
            </div>
            <p className="font-body text-body text-text-muted mt-1">
              {batch.source_area} • Created {formatDateTime(batch.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => {
                  setDeleteBatchReason('');
                  setShowDeleteBatchModal(true);
                }}
                className="h-9 px-3 bg-error-soft hover:bg-red-100 text-error border border-error/30 font-body-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Delete Batch</span>
              </button>
            )}
            {!isHeadOfficer && (
              <button
                onClick={() => {
                  setReassignStage('COLLECTION');
                  setNewAssigneeId('');
                  setReason('');
                  setShowReassignModal(true);
                }}
                className="h-9 px-3 bg-surface hover:bg-background border border-border text-text font-body-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                <span>Reassign Operator</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="h-9 px-3 bg-surface hover:bg-background border border-border text-text font-body-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 4 Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="font-label text-label text-text-muted block">Waste Type</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block">{batch.waste_type}</span>
          </div>
          <div>
            <span className="font-label text-label text-text-muted block">Declared Quantity</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block font-bold">
              {Number(batch.quantity).toLocaleString()} kg
            </span>
          </div>
          <div>
            <span className="font-label text-label text-text-muted block">Route</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block">
              {batch.route_name || batch.route_code || 'Assigned Route'}
            </span>
          </div>
          <div>
            <span className="font-label text-label text-text-muted block">Vehicle</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 block font-mono">
              {batch.vehicle_number || 'Assigned Vehicle'}
            </span>
          </div>
        </div>

        {/* QR Code Bar */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div ref={qrRef} className="p-2 bg-white rounded-lg border border-border shadow-xs">
              <QRCodeCanvas value={trackingUrl} size={72} level="M" />
            </div>
            <div>
              <span className="font-body-medium text-sm font-semibold text-text block">Official Tracking QR</span>
              <span className="font-caption text-xs text-text-muted block mt-0.5">{trackingUrl}</span>
            </div>
          </div>
          <button
            onClick={downloadQrPng}
            className="h-9 px-3 bg-surface hover:bg-background border border-border text-text font-body-medium text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download QR PNG</span>
          </button>
        </div>
      </div>

      {/* 4 Stage Assignees Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'].map((stageName) => {
          const assign = assignments.find((a) => a.stage === stageName);
          return (
            <div key={stageName} className="bg-surface rounded-xl border border-border p-4 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-text-muted tracking-wider uppercase block">{stageName}</span>
                <span className="font-body-medium text-sm font-semibold text-text mt-1 block">
                  {assign?.user_name || 'Unassigned'}
                </span>
                <span className="text-xs text-text-muted block mt-0.5">{assign?.user_email || '—'}</span>
              </div>
              <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-disabled">
                <span>Assigned {assign?.assigned_at ? formatDateTime(assign.assigned_at) : 'Initial'}</span>
                <span className="material-symbols-outlined text-[16px] text-badge-completed-text">verified</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Timeline Section */}
      <section className="bg-surface rounded-xl border border-border p-5 md:p-6 shadow-xs flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-section-title text-section-title text-text">Chain of Custody Timeline</h2>
            <p className="font-caption text-caption text-text-muted">Sequential active stage logs and measurements</p>
          </div>
          <span className="font-caption text-caption text-text-muted">{timeline.length} Recorded Stages</span>
        </div>

        {timeline.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm">
            Batch is in Created status. Awaiting initial collection manifest intake.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {timeline.map((entry) => (
              <div key={entry.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-body-medium text-sm font-bold text-text">{entry.stage}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        v{entry.version_no}
                      </span>
                      {entry.details?.is_flagged && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Flagged Variance ({entry.details?.variance_pct}%)
                        </span>
                      )}
                    </div>
                    <p className="font-caption text-xs text-text-muted mt-0.5">
                      Location: <strong className="text-text">{entry.display_location || '—'}</strong> • Logged by{' '}
                      {entry.operator_name || 'Operator'}
                    </p>
                    {(entry.note || entry.notes) && (
                      <p className="font-caption text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded border border-border">
                        Notes: {entry.note || entry.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 shrink-0">
                  <span className="font-caption text-xs text-text-muted">
                    {formatDateTime(entry.event_time)}
                  </span>

                  {!isHeadOfficer && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditingEntry(entry)}
                        type="button"
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => {
                          setSelectedEntry(entry);
                          setReason('');
                          setShowDeleteEntryModal(true);
                        }}
                        type="button"
                        className="text-xs text-error hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Revision History & Ledger Section */}
      <section className="bg-surface rounded-xl border border-border p-5 md:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-section-title text-section-title text-text">Revision &amp; Audit History</h2>
            <p className="font-caption text-caption text-text-muted">
              Complete historical ledger including superseded entries and administrative modifications
            </p>
          </div>
          <span className="font-caption text-caption text-text-muted">{history.length} Events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-xs text-text-muted font-medium">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Stage</th>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Location / Detail</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">Reason / Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/75">
                  <td className="py-2.5 px-3 text-text-muted whitespace-nowrap">
                    {formatDateTime(h.event_time)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-text">{h.stage}</td>
                  <td className="py-2.5 px-3 font-mono">v{h.version_no}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        h.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : h.status === 'SUPERSEDED'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-muted">{h.display_location || '—'}</td>
                  <td className="py-2.5 px-3 text-text">{h.operator_name || 'System'}</td>
                  <td className="py-2.5 px-3 text-text-muted">
                    {h.delete_reason || h.note || h.notes || 'Initial Entry'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Reassign Operator */}
      {showReassignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !reassignMutation.isPending) {
              setShowReassignModal(false);
            }
          }}
        >
          <div className="bg-surface rounded-xl border border-border max-w-[460px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">Reassign Stage Operator</h3>
              <button
                type="button"
                disabled={reassignMutation.isPending}
                onClick={() => !reassignMutation.isPending && setShowReassignModal(false)}
                className="text-text-muted hover:text-text cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleReassign} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="reassignStage">
                  Target Stage
                </label>
                <select
                  id="reassignStage"
                  value={reassignStage}
                  disabled={reassignMutation.isPending}
                  onChange={(e) => {
                    setReassignStage(e.target.value);
                    setNewAssigneeId('');
                  }}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                >
                  <option value="COLLECTION">Collection</option>
                  <option value="TRANSPORTATION">Transportation</option>
                  <option value="RTS">RTS</option>
                  <option value="PROCESSING">Processing</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="reassignUserSelect">
                  Replacement Operator ({reassignStage})
                </label>
                <select
                  id="reassignUserSelect"
                  required
                  disabled={reassignMutation.isPending}
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                >
                  <option value="">Select active operator...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="reassignReason">
                  Reassignment Reason (Optional)
                </label>
                <input
                  id="reassignReason"
                  type="text"
                  disabled={reassignMutation.isPending}
                  placeholder="e.g. Shift rotation or operator absence"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  disabled={reassignMutation.isPending}
                  onClick={() => !reassignMutation.isPending && setShowReassignModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={reassignMutation.isPending}
                  disabled={!newAssigneeId}
                  loadingText="Updating..."
                  className="h-10 px-5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  Confirm Reassignment
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Entry */}
      {showEditEntryModal && selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updateEntryMutation.isPending) {
              setShowEditEntryModal(false);
            }
          }}
        >
          <div className="bg-surface rounded-xl border border-border max-w-2xl w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">
                Admin Edit Stage Entry ({selectedEntry.stage})
              </h3>
              <button
                type="button"
                disabled={updateEntryMutation.isPending}
                onClick={() => !updateEntryMutation.isPending && setShowEditEntryModal(false)}
                className="text-text-muted hover:text-text cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAdminEditEntry} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderEditField(
                  'event_time',
                  selectedEntry.stage === 'COLLECTION'
                    ? 'Collection Date & Time'
                    : selectedEntry.stage === 'TRANSPORTATION'
                    ? 'Departure Date & Time'
                    : selectedEntry.stage === 'RTS'
                    ? 'RTS Arrival Date & Time'
                    : 'Processing Date & Time',
                  { type: 'datetime-local' }
                )}

                {selectedEntry.stage === 'COLLECTION' && (
                  <>
                    {renderEditField('collection_area', 'Collection Area')}
                    {renderEditField('route_id', 'Route', {
                      options: (editRoutesData?.items || []).map((item) => ({
                        value: item.id,
                        label: `${item.code} - ${item.name}`,
                      })),
                    })}
                    {renderEditField('vehicle_id', 'Vehicle', {
                      options: (editVehiclesData?.items || []).map((item) => ({
                        value: item.id,
                        label: `${item.vehicle_number} (${item.vehicle_type})`,
                      })),
                    })}
                    {renderEditField('driver_id', 'Driver', {
                      options: (editDriversData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('waste_type', 'Waste Type', {
                      options: [
                        { value: 'WET', label: 'Wet' },
                        { value: 'DRY', label: 'Dry' },
                      ],
                    })}
                    {renderEditField('quantity', 'Quantity (kg)', { type: 'number', min: '0.01', step: '0.01' })}
                  </>
                )}

                {selectedEntry.stage === 'TRANSPORTATION' && (
                  <>
                    {renderEditField('start_location', 'Start Location')}
                    {renderEditField('destination', 'Destination')}
                    {renderEditField('rts_location_id', 'Target RTS Facility', {
                      options: (editRtsLocationsData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('vehicle_id', 'Vehicle', {
                      options: (editVehiclesData?.items || []).map((item) => ({
                        value: item.id,
                        label: `${item.vehicle_number} (${item.vehicle_type})`,
                      })),
                    })}
                    {renderEditField('arrival_time', 'Arrival Date & Time', { type: 'datetime-local' })}
                  </>
                )}

                {selectedEntry.stage === 'RTS' && (
                  <>
                    {renderEditField('rts_location_id', 'RTS Intake Station', {
                      options: (editRtsLocationsData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('quantity_received', 'Received Quantity (kg)', {
                      type: 'number',
                      min: '0.01',
                      step: '0.01',
                    })}
                    {renderEditField('waste_category_id', 'Waste Category', {
                      options: (editWasteCategoriesData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('next_facility_id', 'Next Facility', {
                      options: (editFacilitiesData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('handover_details', 'Handover Details')}
                  </>
                )}

                {selectedEntry.stage === 'PROCESSING' && (
                  <>
                    {renderEditField('facility_id', 'Processing Facility', {
                      options: (editFacilitiesData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('process_type_id', 'Process Type', {
                      options: (editProcessTypesData?.items || []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      })),
                    })}
                    {renderEditField('processing_quantity', 'Processed Quantity (kg)', {
                      type: 'number',
                      min: '0.01',
                      step: '0.01',
                    })}
                    {renderEditField('final_status', 'Final Status', {
                      options: ['PROCESSED', 'RECOVERED', 'DISPOSED', 'COMPLETED'].map((value) => ({
                        value,
                        label: value,
                      })),
                    })}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="editNotes">
                  Stage Operational Notes
                </label>
                <textarea
                  id="editNotes"
                  rows="3"
                  maxLength={500}
                  disabled={updateEntryMutation.isPending}
                  value={editFields.note || ''}
                  onChange={(e) => updateEditField('note', e.target.value)}
                  className="p-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="editReason">
                  Administrative Justification / Reason <span className="text-error">*</span>
                </label>
                <input
                  id="editReason"
                  type="text"
                  required
                  disabled={updateEntryMutation.isPending}
                  placeholder="e.g. Corrected operational notes per station supervisor"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  disabled={updateEntryMutation.isPending}
                  onClick={() => !updateEntryMutation.isPending && setShowEditEntryModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={updateEntryMutation.isPending}
                  loadingText="Saving..."
                  className="h-10 px-5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  Save &amp; Audit Changes
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Delete Entry */}
      {showDeleteEntryModal && selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteEntryMutation.isPending) {
              setShowDeleteEntryModal(false);
            }
          }}
        >
          <div className="bg-surface rounded-xl border border-border max-w-[460px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-error-soft flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <div>
                <h3 className="font-section-title text-section-title text-text">
                  Delete Stage Record ({selectedEntry.stage})
                </h3>
                <p className="font-body text-body text-text-muted mt-1 text-xs">
                  This will soft-delete the stage entry and revert batch status. Reverse deletion constraints apply:
                  a later stage active entry must be deleted first.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmDeleteEntry} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="deleteReason">
                  Deletion Reason <span className="text-error">*</span>
                </label>
                <input
                  id="deleteReason"
                  type="text"
                  required
                  disabled={deleteEntryMutation.isPending}
                  placeholder="e.g. Accidental duplicate manifest created"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  disabled={deleteEntryMutation.isPending}
                  onClick={() => !deleteEntryMutation.isPending && setShowDeleteEntryModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={deleteEntryMutation.isPending}
                  loadingText="Deleting..."
                  className="h-10 px-4 bg-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  Confirm Soft Delete
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Delete Batch */}
      {showDeleteBatchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteBatchMutation.isPending) {
              setShowDeleteBatchModal(false);
            }
          }}
        >
          <div className="bg-surface rounded-xl border border-border max-w-[460px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-error-soft flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-[22px]">delete_forever</span>
              </div>
              <div>
                <h3 className="font-section-title text-section-title text-text">
                  Delete Batch ({batch.batch_code})
                </h3>
                <p className="font-body text-body text-text-muted mt-1 text-xs">
                  This permanently deletes the batch, assignments, all stage entries, and their details. A snapshot is retained in the audit log. This action cannot be undone.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteBatch} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="deleteBatchReason">
                  Deletion Reason <span className="text-error">*</span>
                </label>
                <textarea
                  id="deleteBatchReason"
                  rows="3"
                  required
                  disabled={deleteBatchMutation.isPending}
                  placeholder="Specify the reason for deleting this batch (min 5 characters)..."
                  value={deleteBatchReason}
                  onChange={(e) => setDeleteBatchReason(e.target.value)}
                  className="p-3 bg-surface border border-border rounded-lg text-text font-body text-body disabled:opacity-75"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  disabled={deleteBatchMutation.isPending}
                  onClick={() => !deleteBatchMutation.isPending && setShowDeleteBatchModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={deleteBatchMutation.isPending}
                  loadingText="Deleting..."
                  className="h-10 px-4 bg-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium cursor-pointer disabled:opacity-75 flex items-center gap-1.5"
                >
                  Permanently Delete Batch
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
