import React, { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { batchesApi } from '../api/batchesApi';
import { entriesApi } from '../api/entriesApi';
import { usersApi } from '../api/usersApi';
import StatusBadge from '../components/common/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getPublicBaseUrl } from '../utils/url';
import { printBatchManifest } from '../utils/printManifest';
import { formatDateTime } from '../utils/formatDateTime';

export default function BatchDetail() {
  const { code } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const qrRef = useRef(null);

  const isHeadOfficer = user?.role === 'HEAD_OFFICER';

  // Modal dialog states
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [showDeleteEntryModal, setShowDeleteEntryModal] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [actionError, setActionError] = useState('');

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
  });

  const batch = batchData?.batch;
  const assignments = batchData?.assignments || [];
  const timeline = batchData?.timeline || [];
  const history = batchData?.history || [];

  // Fetch active users for reassignments
  const { data: usersData } = useQuery({
    queryKey: ['activeUsersForReassign'],
    queryFn: () => usersApi.getUsers({ is_active: true }),
    enabled: showReassignModal,
  });

  const availableUsers = (usersData?.users || []).filter((u) => u.role === reassignStage);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: ({ id, payload }) => batchesApi.reassignBatch(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
      setShowReassignModal(false);
      setReason('');
      setNewAssigneeId('');
      setActionError('');
      triggerToast(`Reassigned ${reassignStage} operator successfully`);
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to reassign user');
    },
  });

  // Edit entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }) => entriesApi.updateEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
      setShowEditEntryModal(false);
      setSelectedEntry(null);
      setReason('');
      setActionError('');
      triggerToast('Entry updated successfully');
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to update entry');
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: ({ id, reasonText }) => entriesApi.deleteEntry(id, reasonText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchDetail', code] });
      setShowDeleteEntryModal(false);
      setSelectedEntry(null);
      setReason('');
      setActionError('');
      triggerToast('Entry deleted successfully');
    },
    onError: (err) => {
      setActionError(err.message || 'Failed to delete entry');
    },
  });

  const handleReassign = (e) => {
    e.preventDefault();
    if (!newAssigneeId) return;

    reassignMutation.mutate({
      id: batch.id,
      payload: {
        stage: reassignStage,
        user_id: newAssigneeId,
        reason: reason.trim() || `Reassigned ${reassignStage} operator by Administrator`,
      },
    });
  };

  const handleAdminEditEntry = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setActionError('Mandatory justification reason required for administrative modification.');
      return;
    }

    updateEntryMutation.mutate({
      id: selectedEntry.id,
      data: {
        reason: reason.trim(),
        notes: editNotes.trim(),
      },
    });
  };

  const handleConfirmDeleteEntry = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setActionError('Mandatory reason required for deleting stage record.');
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
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">
          progress_activity
        </span>
        <span className="text-sm">Loading batch details...</span>
      </div>
    );
  }

  if (isError || !batch) {
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg bg-surface text-text border border-border animate-fade-in">
          <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
          <span className="font-body text-body text-text">{toastMessage}</span>
        </div>
      )}

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
            {!isHeadOfficer && (
              <button
                onClick={() => {
                  setReassignStage('COLLECTION');
                  setNewAssigneeId('');
                  setReason('');
                  setActionError('');
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
                    {entry.notes && (
                      <p className="font-caption text-xs text-text-muted mt-1 bg-slate-50 p-2 rounded border border-border">
                        Notes: {entry.notes}
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
                        onClick={() => {
                          setSelectedEntry(entry);
                          setEditNotes(entry.notes || '');
                          setReason('');
                          setActionError('');
                          setShowEditEntryModal(true);
                        }}
                        className="text-xs text-primary hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => {
                          setSelectedEntry(entry);
                          setReason('');
                          setActionError('');
                          setShowDeleteEntryModal(true);
                        }}
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
                  <td className="py-2.5 px-3 text-text-muted">{h.delete_reason || h.notes || 'Initial Entry'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Reassign Operator */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[460px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">Reassign Stage Operator</h3>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleReassign} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="reassignStage">
                  Target Stage
                </label>
                <select
                  id="reassignStage"
                  value={reassignStage}
                  onChange={(e) => {
                    setReassignStage(e.target.value);
                    setNewAssigneeId('');
                  }}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
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
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
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
                  placeholder="e.g. Shift rotation or operator absence"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassignMutation.isPending || !newAssigneeId}
                  className="h-10 px-5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  {reassignMutation.isPending ? 'Updating...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Edit Entry */}
      {showEditEntryModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl border border-border max-w-[480px] w-full p-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-section-title text-section-title text-text">
                Admin Edit Stage Entry ({selectedEntry.stage})
              </h3>
              <button
                type="button"
                onClick={() => setShowEditEntryModal(false)}
                className="text-text-muted hover:text-text cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleAdminEditEntry} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="editNotes">
                  Stage Operational Notes
                </label>
                <textarea
                  id="editNotes"
                  rows="3"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="p-3 bg-surface border border-border rounded-lg text-text font-body text-body"
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
                  placeholder="e.g. Corrected operational notes per station supervisor"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditEntryModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEntryMutation.isPending}
                  className="h-10 px-5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  {updateEntryMutation.isPending ? 'Saving...' : 'Save & Audit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Delete Entry */}
      {showDeleteEntryModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
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

            {actionError && (
              <div className="p-3 bg-error-soft text-error text-caption rounded-lg border border-error/20">
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmDeleteEntry} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label text-label text-text-muted" htmlFor="deleteReason">
                  Deletion Reason <span className="text-error">*</span>
                </label>
                <input
                  id="deleteReason"
                  type="text"
                  required
                  placeholder="e.g. Accidental duplicate manifest created"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 px-3 bg-surface border border-border rounded-lg text-text font-body text-body"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteEntryModal(false)}
                  className="h-10 px-4 bg-surface border border-border text-text rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteEntryMutation.isPending}
                  className="h-10 px-4 bg-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium cursor-pointer disabled:opacity-75"
                >
                  {deleteEntryMutation.isPending ? 'Deleting...' : 'Confirm Soft Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
