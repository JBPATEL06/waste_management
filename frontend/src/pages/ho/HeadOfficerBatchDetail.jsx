import React, { useRef, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { batchesApi } from '../../api/batchesApi';
import StatusBadge from '../../components/common/StatusBadge';
import { getPublicBaseUrl } from '../../utils/url';
import { printBatchManifest } from '../../utils/printManifest';

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

export default function HeadOfficerBatchDetail() {
  const { code } = useParams();
  const qrRef = useRef(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Fetch batch details from real API
  const {
    data: batchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['hoBatchDetail', code],
    queryFn: () => batchesApi.getBatch(code),
    enabled: Boolean(code),
  });

  const batch = batchData?.batch;
  const assignments = batchData?.assignments || [];
  const timeline = batchData?.timeline || [];

  const assignmentMap = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      map[a.stage] = a;
    });
    return map;
  }, [assignments]);

  const rtsEntry = useMemo(() => {
    return timeline.find((e) => e.stage === 'RTS');
  }, [timeline]);

  const processingEntry = useMemo(() => {
    return timeline.find((e) => e.stage === 'PROCESSING');
  }, [timeline]);

  const flaggedEntry = useMemo(() => {
    return timeline.find((e) => e.is_flagged || (e.variance_pct != null && Math.abs(Number(e.variance_pct)) > 5));
  }, [timeline]);

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `QR_${batch?.batch_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
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

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">
          progress_activity
        </span>
        <span className="text-sm font-medium">Loading batch details...</span>
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
            to="/ho/batches"
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover"
          >
            Back to Batches
          </Link>
        </div>
      </div>
    );
  }

  const publicBase = getPublicBaseUrl();
  const publicTrackUrl = batch ? `${publicBase}/track/${batch.batch_code}` : '';

  return (
    <div className="flex flex-col w-full pb-space-2xl space-y-6">
      {/* Top Command & Breadcrumb Strip */}
      <div className="flex flex-col gap-space-sm mb-2">
        <div className="flex items-center gap-space-xs font-caption text-caption text-text-muted">
          <Link to="/ho/dashboard" className="hover:text-text transition-colors">Overview</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link to="/ho/batches" className="hover:text-text transition-colors">Batches</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-body-medium text-body-medium text-text font-medium">{batch.batch_code}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-page-title text-page-title text-text tracking-tight">
              Batch {batch.batch_code}
            </h1>
            <StatusBadge status={batch.current_status} />
            {flaggedEntry && (
              <span className="font-badge text-badge px-2.5 py-0.5 rounded-full bg-warning-soft text-badge-transit-text font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Flagged Variance: {Number(flaggedEntry.variance_pct) > 0 ? `+${flaggedEntry.variance_pct}%` : `${flaggedEntry.variance_pct}%`}
              </span>
            )}
          </div>

          {/* Strict Read-Only Global Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/ho/batches"
              className="h-10 px-4 rounded-lg bg-surface border border-border text-text font-body-medium text-body-medium flex items-center gap-2 hover:bg-background transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back to Batches</span>
            </Link>
            <button
              onClick={handlePrint}
              className="h-10 px-4 rounded-lg bg-surface border border-border text-text font-body-medium text-body-medium flex items-center gap-2 hover:bg-background transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print Batch Sheet</span>
            </button>
            <button
              onClick={handleDownloadQR}
              className="h-10 px-4 rounded-lg bg-surface border border-border text-text font-body-medium text-body-medium flex items-center gap-2 hover:bg-background transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              <span>{downloadSuccess ? 'Downloaded!' : 'Download QR Code'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 1: Overview & QR Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Metadata Grid */}
        <div className="lg:col-span-8 bg-surface rounded-xl border border-border p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container text-[20px]">assignment</span>
                <span className="font-section-title text-section-title text-text">
                  Batch Parameters &amp; Net Verified Metrics
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">Created Timestamp</span>
                <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium">
                  {formatDateTime(batch.created_at)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">Waste Classification</span>
                <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${batch.waste_type === 'WET' ? 'bg-primary-container' : 'bg-secondary'}`}></span>
                  {batch.waste_type === 'WET' ? 'Wet Organic (Segregated)' : 'Dry Recyclable'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">Origin Ward / Zone</span>
                <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium">
                  {batch.source_area || '—'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">Gross Collection Weight</span>
                <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium">
                  {Number(batch.quantity || 0).toLocaleString()} kg
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">RTS Verified Weight</span>
                <span className={`font-body-medium text-body-medium mt-0.5 font-medium ${rtsEntry?.is_flagged ? 'text-error' : 'text-text'}`}>
                  {rtsEntry
                    ? `${Number(rtsEntry.quantity_received || rtsEntry.quantity || 0).toLocaleString()} kg (${rtsEntry.variance_pct ? `${Number(rtsEntry.variance_pct) > 0 ? '+' : ''}${rtsEntry.variance_pct}%` : '0%'})`
                    : 'Pending Verification'}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-label text-label text-text-muted">Processing Destination</span>
                <span className="font-body-medium text-body-medium text-text mt-0.5 font-medium">
                  {processingEntry?.display_location || batch.route_name || 'Standard Processing Line'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right QR Code Passport Card */}
        <div className="lg:col-span-4 bg-surface rounded-xl border border-border p-5 flex flex-col items-center text-center justify-between shadow-sm">
          <div className="w-full flex items-center justify-between pb-3 border-b border-border mb-3">
            <span className="font-label text-label text-text-muted uppercase tracking-wider">Physical Passport</span>
            <span className="font-caption text-caption text-text-disabled">Read-Only</span>
          </div>

          <div ref={qrRef} className="w-36 h-36 bg-background border border-border rounded-xl flex items-center justify-center p-2 my-2">
            <QRCodeCanvas
              value={publicTrackUrl}
              size={128}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="flex flex-col gap-1 w-full mt-2">
            <span className="font-batch-id text-batch-id text-text font-mono font-semibold">
              {batch.batch_code}
            </span>
            <span className="font-caption text-caption text-text-muted text-xs">
              Scanning redirects to Public Verification Passport
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Stage Assignment & Custody Holders (Strict Read-Only) */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">badge</span>
            <h2 className="font-section-title text-section-title text-text">Custody Stage Assignments</h2>
          </div>
          <span className="font-caption text-caption text-text-muted">Assigned Personnel</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted">Stage 1 · Collection</span>
            <div className="mt-2">
              <span className="font-body-medium text-body-medium text-text font-medium block">
                {assignmentMap.COLLECTION?.user_name || 'Unassigned'}
              </span>
              <span className="font-caption text-caption text-text-muted">
                {assignmentMap.COLLECTION?.user_email || 'Collection Operator'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted">Stage 2 · Transportation</span>
            <div className="mt-2">
              <span className="font-body-medium text-body-medium text-text font-medium block">
                {assignmentMap.TRANSPORTATION?.user_name || 'Unassigned'}
              </span>
              <span className="font-caption text-caption text-text-muted">
                {assignmentMap.TRANSPORTATION?.user_email || 'Fleet Driver / Ops'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted">Stage 3 · RTS Checkpoint</span>
            <div className="mt-2">
              <span className="font-body-medium text-body-medium text-text font-medium block">
                {assignmentMap.RTS?.user_name || 'Unassigned'}
              </span>
              <span className="font-caption text-caption text-text-muted">
                {assignmentMap.RTS?.user_email || 'RTS Station Officer'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border flex flex-col justify-between">
            <span className="font-label text-label text-text-muted">Stage 4 · Final Processing</span>
            <div className="mt-2">
              <span className="font-body-medium text-body-medium text-text font-medium block">
                {assignmentMap.PROCESSING?.user_name || 'Unassigned'}
              </span>
              <span className="font-caption text-caption text-text-muted">
                {assignmentMap.PROCESSING?.user_email || 'Facility Manager'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Verified Stage Progression Timeline */}
      <section className="bg-surface rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container text-[20px]">timeline</span>
            <h2 className="font-section-title text-section-title text-text">Chain of Custody Progression</h2>
          </div>
          <span className="text-xs text-text-muted">
            {timeline.length} stage record{timeline.length === 1 ? '' : 's'} logged
          </span>
        </div>

        {timeline.length === 0 ? (
          <div className="py-8 text-center text-text-muted text-sm bg-background rounded-xl border border-border">
            No stage entries have been submitted yet for this batch.
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.map((entry) => {
              const isEntryFlagged = entry.is_flagged || (entry.variance_pct != null && Math.abs(Number(entry.variance_pct)) > 5);
              const stageIcon =
                entry.stage === 'COLLECTION'
                  ? 'inventory_2'
                  : entry.stage === 'TRANSPORTATION'
                  ? 'local_shipping'
                  : entry.stage === 'RTS'
                  ? 'compare_arrows'
                  : 'recycling';

              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                    isEntryFlagged
                      ? 'bg-warning-soft/20 border-warning/40'
                      : 'bg-background border-border'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[24px] ${
                      isEntryFlagged ? 'text-warning' : 'text-primary-container'
                    }`}
                  >
                    {isEntryFlagged ? 'warning' : stageIcon}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-body-medium text-body-medium text-text font-medium flex items-center gap-2">
                        {entry.stage} Recorded
                        <span className="text-xs font-normal text-text-muted">v{entry.version_no}</span>
                      </span>
                      <span className="font-caption text-caption text-text-muted">
                        {formatDateTime(entry.event_time || entry.created_at)}
                      </span>
                    </div>
                    <p className="font-caption text-caption text-text-muted mt-1">
                      Location: <strong className="text-text">{entry.display_location || '—'}</strong>
                      {entry.quantity != null && ` • Verified Weight: ${Number(entry.quantity).toLocaleString()} kg`}
                      {entry.driver_name && ` • Driver: ${entry.driver_name}`}
                      {entry.creator_name && ` • Logged by ${entry.creator_name}`}
                    </p>
                    {entry.variance_pct != null && (
                      <p className={`text-xs mt-1 font-medium ${isEntryFlagged ? 'text-error' : 'text-text-muted'}`}>
                        Variance: {Number(entry.variance_pct) > 0 ? `+${entry.variance_pct}%` : `${entry.variance_pct}%`}
                        {entry.quantity_received && ` (Received: ${Number(entry.quantity_received).toLocaleString()} kg)`}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-text-muted italic mt-1 bg-surface/50 p-2 rounded border border-border/50">
                        "{entry.notes}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
