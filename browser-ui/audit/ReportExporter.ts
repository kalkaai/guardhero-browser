// Copyright (c) 2025 Guard Hero. All rights reserved.
// ReportExporter.ts — Export audit report as JSON or PDF.

export interface AuditReportData {
  url: string;
  auditTime: string;
  totalRequests: number;
  blockedRequests: number;
  thirdPartyPercent: number;
  bytesSaved: number;
  trackersByCategory: Record<string, TrackerItem[]>;
  fingerprintSurface: FingerprintSurfaceData;
}

export interface TrackerItem {
  domain: string;
  requestCount: number;
  severityScore: number;
  sampleUrls: string[];
}

export interface FingerprintSurfaceData {
  canvas: boolean;
  webgl: boolean;
  audioContext: boolean;
  fonts: boolean;
  screen: boolean;
  battery: boolean;
  networkInfo: boolean;
  webrtc: boolean;
}

export function exportAsJson(data: AuditReportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guardhero-audit-${encodeURIComponent(new URL(data.url).hostname)}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAsPdf(): void {
  // Inject print-specific styles, then call window.print().
  // The browser will use the @media print CSS defined in the audit page
  // to format the report nicely.
  const style = document.createElement('style');
  style.id = 'guardhero-print-styles';
  style.textContent = `
    @media print {
      body { background: #fff !important; color: #000 !important; font-family: Arial, sans-serif; }
      .audit-toolbar, .audit-export-btn, .no-print { display: none !important; }
      .audit-root { padding: 20mm; }
      .audit-header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
      .audit-header h1 { font-size: 20pt; margin: 0 0 4px; }
      .audit-header .audit-url { font-size: 12pt; color: #555; }
      .audit-section { break-inside: avoid; margin-bottom: 24px; }
      .audit-section-title { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; }
      .tracker-row { border-bottom: 1px solid #eee; padding: 4px 0; }
      .tracker-domain { font-weight: bold; }
      .severity-bar { display: none; }
      .fp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .fp-item { border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center; }
      .fp-item.exposed { border-color: #d32f2f; background: #fff8f8; }
      .fp-item.blocked { border-color: #388e3c; background: #f8fff8; }
    }
  `;
  document.head.appendChild(style);
  window.print();
  // Remove styles after print dialog closes
  setTimeout(() => {
    document.head.removeChild(style);
  }, 2000);
}
