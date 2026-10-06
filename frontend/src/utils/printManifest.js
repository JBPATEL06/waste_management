import { getPublicBaseUrl } from './url';

/**
 * Generates and triggers a comprehensive, professional printable Batch Manifest & Custody Passport.
 * Solves the issue where printing previously only rendered a solitary QR code image on a blank page.
 */
export function printBatchManifest({
  batch,
  qrCanvas,
  timeline = [],
  assignments = [],
}) {
  if (!batch) return;

  const publicBase = getPublicBaseUrl();
  const trackingUrl = `${publicBase}/track/${batch.batch_code}`;
  const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : '';

  const wasteTypeLabels = {
    WET: 'Wet Organic Waste',
    DRY: 'Dry Recyclable Waste',
    HAZARDOUS: 'Hazardous Waste',
    ELECTRONIC: 'E-Waste',
  };

  const statusColors = {
    CREATED: '#3b82f6',
    COLLECTED: '#eab308',
    IN_TRANSIT: '#f97316',
    AT_RTS: '#8b5cf6',
    COMPLETED: '#16a34a',
  };

  const statusColor = statusColors[batch.current_status] || '#15803d';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const creationDate = batch.created_at
    ? new Date(batch.created_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      })
    : 'N/A';

  const activeTimeline = (timeline && timeline.length > 0)
    ? timeline
    : (batch.timeline || []);

  const activeAssignments = (assignments && assignments.length > 0)
    ? assignments
    : (batch.assignments || []);

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Batch Manifest - ${batch.batch_code}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      line-height: 1.45;
      font-size: 13px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #15803d;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .header-left h1 {
      font-size: 20px;
      font-weight: 700;
      color: #15803d;
      letter-spacing: -0.02em;
    }
    .header-left p {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background-color: ${statusColor}15;
      color: ${statusColor};
      border: 1px solid ${statusColor}40;
      margin-bottom: 4px;
    }
    .top-summary {
      display: grid;
      grid-template-columns: 1fr 180px;
      gap: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .manifest-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px 20px;
    }
    .field-item {
      display: flex;
      flex-direction: column;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .field-value {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .batch-code-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      color: #15803d;
      font-weight: 700;
    }
    .qr-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-left: 1px solid #e2e8f0;
      padding-left: 20px;
      text-align: center;
    }
    .qr-card img {
      width: 120px;
      height: 120px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px;
      background: #ffffff;
    }
    .qr-caption {
      font-size: 10px;
      color: #64748b;
      margin-top: 6px;
      line-height: 1.2;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 12px;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      margin-bottom: 18px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.04em;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .signatures-block {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .signature-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .signature-line {
      width: 100%;
      height: 1px;
      border-bottom: 1px solid #0f172a;
      margin-bottom: 6px;
    }
    .signature-role {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #475569;
    }
    .signature-date {
      font-size: 9.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .footer-note {
      text-align: center;
      margin-top: 24px;
      font-size: 9.5px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="header-left">
      <h1>WasteFlow Custody Manifest</h1>
      <p>Municipal Solid Waste Closed-Loop Tracking System</p>
    </div>
    <div class="header-right">
      <div class="status-badge">${batch.current_status || 'CREATED'}</div>
      <div>Printed: ${new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</div>
    </div>
  </div>

  <div class="top-summary">
    <div class="manifest-details">
      <div class="field-item">
        <span class="field-label">Batch Identification Number</span>
        <span class="field-value batch-code-val">${batch.batch_code}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Waste Categorization</span>
        <span class="field-value">${wasteTypeLabels[batch.waste_type] || batch.waste_type}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Source / Origin Ward</span>
        <span class="field-value">${batch.source_area || '—'}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Batch Net Quantity</span>
        <span class="field-value">${Number(batch.quantity || 0).toLocaleString()} kg</span>
      </div>
      <div class="field-item">
        <span class="field-label">Assigned Route</span>
        <span class="field-value">${batch.route_code ? `${batch.route_code} - ${batch.route_name || ''}` : (batch.route_name || 'Standard Route')}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Registered Vehicle</span>
        <span class="field-value">${batch.vehicle_number ? `${batch.vehicle_number} (${batch.vehicle_type || 'Truck'})` : (batch.vehicle_type || 'Municipal Fleet')}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Creation Timestamp</span>
        <span class="field-value">${creationDate}</span>
      </div>
      <div class="field-item">
        <span class="field-label">Digital Passport Verification</span>
        <span class="field-value" style="font-size: 11px; word-break: break-all; color: #15803d;">${trackingUrl}</span>
      </div>
    </div>

    ${qrDataUrl ? `
    <div class="qr-card">
      <img src="${qrDataUrl}" alt="Scannable Batch Passport QR" />
      <span class="qr-caption">Scan to verify batch authenticity in real-time</span>
    </div>
    ` : ''}
  </div>

  ${activeTimeline.length > 0 ? `
  <div class="section-title">Custody Chain Milestones</div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Stage</th>
        <th style="width: 25%;">Recorded Timestamp</th>
        <th style="width: 45%;">Facility / Location</th>
        <th style="width: 15%;">State</th>
      </tr>
    </thead>
    <tbody>
      ${activeTimeline.map((item) => `
        <tr>
          <td><strong>${item.stage}</strong></td>
          <td>${item.event_time ? new Date(item.event_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : 'Recorded'}</td>
          <td>${item.display_location || '—'}</td>
          <td><span style="color: #16a34a; font-weight: 600;">VERIFIED</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${activeAssignments.length > 0 ? `
  <div class="section-title">Assigned Custody Operators</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Operational Node</th>
        <th style="width: 40%;">Operator Name</th>
        <th style="width: 35%;">Contact / Identifier</th>
      </tr>
    </thead>
    <tbody>
      ${activeAssignments.map((a) => `
        <tr>
          <td><strong>${a.stage}</strong></td>
          <td>${a.user_name || a.name || 'Assigned Officer'}</td>
          <td>${a.user_email || a.email || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="signatures-block">
    <div class="signature-item">
      <div class="signature-line" style="margin-top: 35px;"></div>
      <span class="signature-role">Collection Supervisor</span>
      <span class="signature-date">Signature & Seal</span>
    </div>
    <div class="signature-item">
      <div class="signature-line" style="margin-top: 35px;"></div>
      <span class="signature-role">Transport Weighmaster</span>
      <span class="signature-date">Signature & Seal</span>
    </div>
    <div class="signature-item">
      <div class="signature-line" style="margin-top: 35px;"></div>
      <span class="signature-role">Processing Officer</span>
      <span class="signature-date">Signature & Seal</span>
    </div>
  </div>

  <div class="footer-note">
    Official municipal tracking manifest document issued under Municipal Solid Waste Closed-Loop Custody Regulations.<br />
    Any alteration or unauthorized duplication invalidates this tracking passport.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
}

