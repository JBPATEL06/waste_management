import React, { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { publicApi } from '../api/publicApi';
import StatusBadge from '../components/common/StatusBadge';
import { getPublicBaseUrl } from '../utils/url';

export default function PublicTracking() {
  const { batchCode } = useParams();
  const qrRef = useRef(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['publicBatch', batchCode],
    queryFn: () => publicApi.trackBatch(batchCode),
    enabled: Boolean(batchCode),
    retry: 1,
  });

  const batch = data?.batch;

  const downloadQrPng = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `QR_${batch?.batch_code || batchCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - ${batch?.batch_code || batchCode}</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            h2 { margin-bottom: 8px; }
            p { margin-top: 4px; color: #555; }
            img { width: 220px; height: 220px; }
          </style>
        </head>
        <body>
          <h2>Waste Journey Tracker</h2>
          <img src="${pngUrl}" />
          <p><strong>Batch: ${batch?.batch_code || batchCode}</strong></p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stagesDefinition = [
    { key: 'COLLECTION', title: 'Collection', defaultLocation: 'Collection Point' },
    { key: 'TRANSPORTATION', title: 'Transportation', defaultLocation: 'Transit to RTS' },
    { key: 'RTS', title: 'RTS / Transfer', defaultLocation: 'Refuse Transfer Station' },
    { key: 'PROCESSING', title: 'Processing', defaultLocation: 'Processing & Recovery Depot' },
  ];

  const stageOrder = ['COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'];
  const currentStageIndex = batch?.current_status === 'COMPLETED' ? 4 : (batch?.timeline?.length ? stageOrder.indexOf(batch.timeline[batch.timeline.length - 1]?.stage) : 0);

  const publicBase = getPublicBaseUrl();
  const trackingUrl = `${publicBase}/track/${batch?.batch_code || batchCode}`;

  return (
    <div className="bg-background font-body text-text min-h-screen">
      {/* Top Bar with Logo only */}
      <header className="h-14 bg-surface border-b border-border flex items-center px-6">
        <div className="max-w-[720px] w-full mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[20px]">recycling</span>
            </div>
            <span className="font-semibold text-[17px] text-text tracking-tight">
              Waste Journey Tracker
            </span>
          </Link>
          <Link
            to="/track"
            className="text-xs text-text-muted hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            <span>Search another</span>
          </Link>
        </div>
      </header>

      {/* Main Public Tracking Content */}
      <main className="max-w-[720px] mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {isLoading && (
          <div className="bg-surface rounded-xl border border-border p-8 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined animate-spin text-primary text-[32px]">
              progress_activity
            </span>
            <span className="text-sm text-text-muted">Loading batch tracking information...</span>
          </div>
        )}

        {isError && (
          <div className="bg-surface rounded-xl border border-border p-8 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-error-soft text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </div>
            <div>
              <h2 className="text-section-title font-semibold text-text">Batch Not Found</h2>
              <p className="text-sm text-text-muted mt-1">
                {error?.message || `No tracking information exists for batch code "${batchCode}".`}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-surface border border-border hover:bg-slate-50 text-text text-sm rounded-lg flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Retry</span>
              </button>
              <Link
                to="/track"
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-hover text-sm rounded-lg"
              >
                Search Another Batch
              </Link>
            </div>
          </div>
        )}

        {batch && (
          <>
            {/* Card 1: Batch Identification Card */}
            <section className="bg-surface rounded-xl border border-border p-5 sm:p-6 shadow-sm flex flex-col gap-5">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <span className="font-label text-label text-text-muted block">Tracking Identifier</span>
                  <span className="font-batch-id text-[20px] sm:text-[22px] font-bold text-text tracking-wide mt-0.5 block">
                    {batch.batch_code}
                  </span>
                </div>
                <StatusBadge status={batch.current_status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-label text-label text-text-muted block">Waste Type</span>
                  <span className="font-body-medium text-body-medium text-text mt-0.5 block">
                    {batch.waste_type}
                  </span>
                </div>

                <div>
                  <span className="font-label text-label text-text-muted block">Quantity</span>
                  <span className="font-body-medium text-body-medium text-text mt-0.5 block">
                    {Number(batch.quantity).toLocaleString()} kg
                  </span>
                </div>

                <div>
                  <span className="font-label text-label text-text-muted block">Source / Area</span>
                  <span className="font-body-medium text-body-medium text-text mt-0.5 block">
                    {batch.source_area}
                  </span>
                </div>

                <div>
                  <span className="font-label text-label text-text-muted block">Current Status</span>
                  <span className="font-body-medium text-body-medium text-text mt-0.5 block">
                    {batch.current_status}
                  </span>
                </div>
              </div>

              {/* Client-side QR Generation with Download PNG and Print */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-4">
                  <div ref={qrRef} className="p-2 bg-white rounded-lg border border-border shadow-xs">
                    <QRCodeCanvas value={trackingUrl} size={84} level="M" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-text block">Official QR Passport</span>
                    <span className="text-xs text-text-muted block mt-0.5">Scan to verify this batch in real time</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={downloadQrPng}
                    type="button"
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-surface border border-border hover:bg-slate-50 text-text font-caption text-caption rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>Download PNG</span>
                  </button>
                  <button
                    onClick={printQr}
                    type="button"
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-surface border border-border hover:bg-slate-50 text-text font-caption text-caption rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Card 2: Journey Timeline */}
            <section className="bg-surface rounded-xl border border-border p-5 sm:p-6 shadow-sm flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="font-section-title text-section-title text-text">Journey Timeline</h2>
                <span className="font-caption text-caption text-text-muted">4 Milestones</span>
              </div>

              <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-[11px] sm:before:left-[15px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border">
                {stagesDefinition.map((stageDef, idx) => {
                  const stageEntry = batch.timeline?.find((e) => e.stage === stageDef.key);
                  const isCompleted = stageEntry && stageEntry.status === 'ACTIVE' && (batch.current_status === 'COMPLETED' || idx < currentStageIndex);
                  const isCurrent = stageEntry && stageEntry.status === 'ACTIVE' && !isCompleted && batch.current_status !== 'COMPLETED';
                  const isPending = !isCompleted && !isCurrent;

                  return (
                    <div key={stageDef.key} className="relative flex items-start justify-between gap-4">
                      {/* Node icon */}
                      <div className="absolute -left-6 sm:-left-8 top-0.5">
                        {isCompleted ? (
                          <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">check</span>
                          </div>
                        ) : isCurrent ? (
                          <div className="w-6 h-6 rounded-full bg-badge-transit-bg border-2 border-warning text-warning flex items-center justify-center text-xs">
                            <div className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse"></div>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface border-2 border-border text-text-disabled flex items-center justify-center text-xs">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                          </div>
                        )}
                      </div>

                      {/* Stage text info */}
                      <div className="flex flex-col">
                        <span
                          className={`font-body-medium text-body-medium ${
                            isPending ? 'text-text-disabled' : 'text-text font-semibold'
                          }`}
                        >
                          {stageDef.title}
                        </span>
                        <span
                          className={`font-caption text-caption mt-0.5 ${
                            isPending ? 'text-text-disabled' : 'text-text-muted'
                          }`}
                        >
                          {stageEntry?.display_location || stageDef.defaultLocation}
                        </span>
                      </div>

                      {/* Stage Status and Time */}
                      <div className="text-right flex flex-col items-end shrink-0">
                        {isCompleted ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-badge-completed-bg text-badge-completed-text">
                              Completed
                            </span>
                            <span className="font-caption text-caption text-text-muted mt-1">
                              {stageEntry?.event_time ? new Date(stageEntry.event_time).toLocaleString() : 'Recorded'}
                            </span>
                          </>
                        ) : isCurrent ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-badge-transit-bg text-badge-transit-text">
                              In Progress
                            </span>
                            <span className="font-caption text-caption text-text-muted mt-1">
                              {stageEntry?.event_time ? new Date(stageEntry.event_time).toLocaleString() : 'Active'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                              Pending
                            </span>
                            <span className="font-caption text-caption text-text-disabled mt-1">—</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Footer info */}
            <div className="text-center text-xs text-text-muted py-2">
              <span>Official municipal waste tracking verification record.</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
