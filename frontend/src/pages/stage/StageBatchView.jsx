import React, { useMemo } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STAGE_CONFIG } from '../../constants/stages';
import { batchesApi } from '../../api/batchesApi';
import StatusBadge from '../../components/common/StatusBadge';
import { DetailSkeleton } from '../../components/Skeleton';
import { formatDateTime } from '../../utils/formatDateTime';



export default function StageBatchView({ role: propRole }) {
  const { code } = useParams();
  const location = useLocation();

  // Resolve role config
  let roleKey = propRole;
  if (!roleKey) {
    if (location.pathname.startsWith('/transportation')) roleKey = 'transportation';
    else if (location.pathname.startsWith('/rts')) roleKey = 'rts';
    else if (location.pathname.startsWith('/processing')) roleKey = 'processing';
    else roleKey = 'collection';
  }

  const cfg = STAGE_CONFIG[roleKey] || STAGE_CONFIG.collection;

  // Fetch real batch details from backend
  const {
    data: batchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stageBatchView', code],
    queryFn: () => batchesApi.getBatch(code),
    enabled: Boolean(code),
    staleTime: 15 * 1000,
  });

  const batch = batchData?.batch;
  const timeline = batchData?.timeline || [];

  // Check if own stage entry exists
  const ownStageEntry = useMemo(() => {
    return timeline.find((e) => e.stage === cfg.roleKey && e.status === 'ACTIVE');
  }, [timeline, cfg.roleKey]);

  const hasOwnEntry = !!ownStageEntry;

  // Filter previous stages relative to this role's stage number
  const previousEntries = useMemo(() => {
    const stageOrder = ['COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'];
    const currentIdx = stageOrder.indexOf(cfg.roleKey);
    if (currentIdx <= 0) return [];
    const prevStages = stageOrder.slice(0, currentIdx);
    return timeline.filter((e) => prevStages.includes(e.stage));
  }, [timeline, cfg.roleKey]);

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
          <p className="text-sm text-text-muted mt-1">{error?.message || `No batch found for code "${code}"`}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-surface border border-border text-sm rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Retry
          </button>
          <Link
            to={`${cfg.prefix}/dashboard`}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover"
          >
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1080px] w-full mx-auto space-y-space-lg pb-space-2xl">
      {/* Breadcrumb & Back Bar */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center gap-space-sm text-text-muted font-caption text-caption">
          <Link
            to={`${cfg.prefix}/dashboard`}
            className="inline-flex items-center gap-1 hover:text-text transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Queue</span>
          </Link>
          <span className="text-text-disabled">/</span>
          <Link to={`${cfg.prefix}/dashboard`} className="hover:text-text transition-colors">
            Queue Dashboard
          </Link>
          <span className="text-text-disabled">/</span>
          <span className="font-body-medium text-text">{batch.batch_code}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-space-md pt-space-xs">
          <div className="flex items-center gap-space-md">
            <h1 className="font-batch-id text-page-title text-text tracking-tight font-mono">
              {batch.batch_code}
            </h1>
            <StatusBadge status={batch.current_status} />
          </div>
          <div className="flex items-center gap-1.5 text-text-muted font-caption text-caption">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>Created: {formatDateTime(batch.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 1. Batch Information Card */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-space-md border-b border-border mb-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-text-muted text-[20px]">assignment</span>
            <h2 className="font-section-title text-section-title text-text">Batch Information</h2>
          </div>
          <span className="font-caption text-caption text-text-muted">
            Batch ID: {batch.batch_code}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-space-xl gap-y-space-md">
          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Waste Type</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  batch.waste_type === 'WET' ? 'bg-primary-container' : 'bg-secondary'
                }`}
              ></span>
              <span className="font-body-medium text-body-medium text-text">
                {batch.waste_type === 'WET' ? 'Wet Organic' : 'Dry Recyclable'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Declared Quantity</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium">
              {Number(batch.quantity).toLocaleString()} kg
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Source / Origin Area</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5">
              {batch.source_area || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Assigned Route</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5">
              {batch.route_name || 'Standard Route'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Assigned Vehicle</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5">
              {batch.vehicle_number || 'Standard Fleet'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="font-label text-label text-text-muted">Batch Generation Date</span>
            <span className="font-body-medium text-body-medium text-text mt-0.5">
              {formatDateTime(batch.batch_date || batch.created_at)}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Previous Stages (Read-only) */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-space-sm pb-space-sm border-b border-border mb-space-md">
          <span className="material-symbols-outlined text-text-muted text-[20px]">history_edu</span>
          <h2 className="font-section-title text-section-title text-text">Previous Stages</h2>
        </div>

        {cfg.stageNumber === 1 ? (
          <div className="rounded-lg bg-background border border-border p-space-md flex items-start gap-space-sm text-text-muted">
            <span className="material-symbols-outlined text-[20px] text-text-disabled mt-0.5">info</span>
            <div className="flex flex-col">
              <span className="font-body-medium text-body-medium text-text">Initial Custody Stage</span>
              <span className="font-caption text-caption text-text-muted mt-0.5">
                No prior stage entries required for Collection. This batch originated at pickup generation.
              </span>
            </div>
          </div>
        ) : previousEntries.length === 0 ? (
          <div className="rounded-lg bg-background border border-border p-space-md flex items-start gap-space-sm text-text-muted">
            <span className="material-symbols-outlined text-[20px] text-text-disabled mt-0.5">lock_clock</span>
            <div className="flex flex-col">
              <span className="font-body-medium text-body-medium text-text">Upstream Entry Pending</span>
              <span className="font-caption text-caption text-text-muted mt-0.5">
                The preceding stage operators have not finalized active entries for this batch yet.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {previousEntries.map((prev) => (
              <div
                key={prev.id}
                className="rounded-lg bg-background border border-border p-space-md flex items-start gap-space-sm"
              >
                <span className="material-symbols-outlined text-primary-container text-[20px] mt-0.5">
                  {prev.stage === 'COLLECTION'
                    ? 'inventory_2'
                    : prev.stage === 'TRANSPORTATION'
                    ? 'local_shipping'
                    : 'compare_arrows'}
                </span>
                <div className="flex flex-col w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-body-medium text-body-medium text-text font-medium">
                      {prev.stage} Entry (Stage {prev.stage === 'COLLECTION' ? 1 : prev.stage === 'TRANSPORTATION' ? 2 : 3})
                    </span>
                    <span className="font-badge text-badge px-2 py-0.5 rounded-full bg-badge-completed-bg text-badge-completed-text font-medium">
                      Verified
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 font-caption text-caption text-text-muted">
                    <div>
                      Location: <strong className="text-text">{prev.display_location || '—'}</strong>
                    </div>
                    {prev.quantity && (
                      <div>
                        Weighed: <strong className="text-text">{Number(prev.quantity).toLocaleString()} kg</strong>
                      </div>
                    )}
                    {prev.driver_name && (
                      <div>
                        Driver: <strong className="text-text">{prev.driver_name}</strong>
                      </div>
                    )}
                    <div>
                      Logged: <span className="text-text">{formatDateTime(prev.event_time || prev.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Own Stage Section */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-space-md border-b border-border mb-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary-container text-[20px]">
              {cfg.stageNumber === 1
                ? 'inventory_2'
                : cfg.stageNumber === 2
                ? 'local_shipping'
                : cfg.stageNumber === 3
                ? 'compare_arrows'
                : 'recycling'}
            </span>
            <h2 className="font-section-title text-section-title text-text">
              Own Stage: {cfg.ownStageTitle}
            </h2>
          </div>
          <span
            className={`font-badge text-badge px-2 py-0.5 rounded-full font-medium ${
              hasOwnEntry
                ? 'bg-badge-completed-bg text-badge-completed-text'
                : 'bg-badge-created-bg text-badge-created-text'
            }`}
          >
            {hasOwnEntry ? 'Submitted / Active' : 'Pending Submission'}
          </span>
        </div>

        <div className="flex flex-col gap-space-md">
          {!hasOwnEntry ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-background border border-border rounded-lg p-space-md">
              <div className="flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-primary-container text-[20px] mt-0.5">
                  edit_note
                </span>
                <div className="flex flex-col">
                  <span className="font-body-medium text-body-medium text-text font-medium">
                    Ready for data entry
                  </span>
                  <span className="font-caption text-caption text-text-muted">
                    {cfg.roleLabel} manifest has not been submitted yet. Log manifest parameters and operator signoff.
                  </span>
                </div>
              </div>
              <Link
                to={`${cfg.prefix}/batches/${batch.batch_code}/entry`}
                className="inline-flex items-center justify-center gap-space-xs h-10 px-space-md rounded-lg bg-primary-container hover:bg-primary-hover text-on-primary font-body-medium text-body-medium transition-colors shrink-0 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add {cfg.roleLabel} Entry</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-background border border-border rounded-lg p-space-md">
              <div className="flex items-start gap-space-sm">
                <span className="material-symbols-outlined text-primary-container text-[20px] mt-0.5">
                  check_circle
                </span>
                <div className="flex flex-col">
                  <span className="font-body-medium text-body-medium text-text font-medium">
                    Current Valid Entry (v{ownStageEntry.version_no || 1}.0)
                  </span>
                  <span className="font-caption text-caption text-text-muted">
                    Submitted on {formatDateTime(ownStageEntry.created_at)} by {ownStageEntry.creator_name || 'Operator'}.
                    {ownStageEntry.quantity && ` Weighed: ${Number(ownStageEntry.quantity).toLocaleString()} kg.`}
                  </span>
                </div>
              </div>
              <Link
                to={`${cfg.prefix}/batches/${batch.batch_code}/entry?mode=correction`}
                className="inline-flex items-center justify-center gap-space-xs h-10 px-space-md rounded-lg bg-warning-soft text-warning border border-warning/30 hover:bg-amber-100 font-body-medium text-body-medium transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Submit Correction</span>
              </Link>
            </div>
          )}

          {/* Lock Protocol Notice */}
          <div className="rounded-lg bg-warning-soft border border-warning/20 p-space-md flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-warning text-[20px] shrink-0 mt-0.5">
              lock_clock
            </span>
            <div className="flex flex-col gap-1 text-text">
              <span className="font-label text-label font-medium text-text">
                Stage Governance &amp; Sequence Locking
              </span>
              <p className="font-caption text-caption text-text-muted leading-relaxed">
                If prior stage dependencies were unmet, entry access remains disabled with status "Waiting for previous stage entry". Once recorded, stage operator direct edits are locked. Post-submission adjustments require a formal correction entry logged to the immutable audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
