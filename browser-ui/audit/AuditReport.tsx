// Copyright (c) 2025 Guard Hero. All rights reserved.
// AuditReport.tsx — Main audit report page rendered at guardhero://audit
// Takes ?url= query param, calls chrome.guardhero.runAudit(url),
// then renders TrackerBreakdown and FingerprintSurface.

import '../mocks/chrome-guardhero';
import { useState, useEffect } from 'react';
import { TrackerBreakdown } from './TrackerBreakdown';
import { FingerprintSurface } from './FingerprintSurface';
import {
  AuditReportData,
  exportAsJson,
  exportAsPdf,
} from './ReportExporter';

// Mock audit data for development
function mockAuditResult(url: string): AuditReportData {
  return {
    url,
    auditTime: new Date().toISOString(),
    totalRequests: 48,
    blockedRequests: 14,
    thirdPartyPercent: 62.5,
    bytesSaved: 114688,
    trackersByCategory: {
      Analytics: [
        { domain: 'google-analytics.com', requestCount: 4, severityScore: 85, sampleUrls: [] },
        { domain: 'hotjar.com', requestCount: 2, severityScore: 70, sampleUrls: [] },
        { domain: 'mixpanel.com', requestCount: 1, severityScore: 60, sampleUrls: [] },
      ],
      Advertising: [
        { domain: 'doubleclick.net', requestCount: 3, severityScore: 90, sampleUrls: [] },
        { domain: 'googlesyndication.com', requestCount: 2, severityScore: 80, sampleUrls: [] },
      ],
      Social: [
        { domain: 'facebook.net', requestCount: 2, severityScore: 75, sampleUrls: [] },
      ],
      'CNAME-cloaked': [],
    },
    fingerprintSurface: {
      canvas: true,
      webgl: true,
      audioContext: true,
      fonts: false,
      screen: true,
      battery: false,
      networkInfo: false,
      webrtc: true,
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0A0E1A; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; }
  .audit-root { max-width: 900px; margin: 0 auto; padding: 24px; }
  .audit-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .audit-toolbar-title { font-weight: 700; font-size: 18px; flex: 1; }
  .audit-export-btn { padding: 6px 14px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8892A4; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .audit-export-btn:hover { color: #fff; }
  .audit-export-btn.primary { background: rgba(0,212,255,0.1); border-color: rgba(0,212,255,0.3); color: var(--accent, #00D4FF); }
  .audit-header { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .audit-url { font-size: 16px; font-weight: 600; word-break: break-all; margin-bottom: 16px; }
  .audit-stats-row { display: flex; gap: 24px; flex-wrap: wrap; }
  .audit-stat { display: flex; flex-direction: column; gap: 2px; }
  .audit-stat-value { font-size: 28px; font-weight: 700; }
  .audit-stat-label { font-size: 11px; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-blocked { color: #FF4B6E; }
  .stat-accent { color: var(--accent, #00D4FF); }
  .stat-green { color: #27C174; }
  .stat-warn { color: #FFB800; }
  .audit-section { margin-bottom: 24px; }
  .audit-section-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .audit-section-title .section-icon { font-size: 18px; }
  .audit-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; gap: 16px; color: #8892A4; }
  .audit-spinner { width: 40px; height: 40px; border: 3px solid rgba(0,212,255,0.15); border-top-color: #00D4FF; border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .audit-error { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 12px; color: #FF4B6E; }

  /* TrackerBreakdown */
  .tc-root { display: flex; flex-direction: column; gap: 8px; }
  .tc-card { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; }
  .tc-card-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; border-left: 3px solid transparent; }
  .tc-card-header:hover { background: rgba(255,255,255,0.02); }
  .tc-cat-icon { font-size: 18px; }
  .tc-cat-name { font-weight: 600; font-size: 14px; flex: 1; }
  .tc-cat-count, .tc-cat-reqs { font-size: 12px; color: #8892A4; }
  .tc-sev-badge { font-size: 11px; font-weight: 700; }
  .tc-chevron { font-size: 12px; color: #8892A4; }
  .tc-tracker-list { padding: 8px 16px 12px; display: flex; flex-direction: column; gap: 6px; }
  .tc-tracker-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .tc-tracker-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .tracker-domain { font-size: 13px; font-weight: 500; }
  .tc-tracker-reqs { font-size: 11px; color: #8892A4; }
  .tc-severity-bar-wrap { width: 120px; display: flex; align-items: center; gap: 8px; }
  .severity-bar { height: 4px; border-radius: 2px; transition: width 0.3s; }
  .tc-severity-label { font-size: 11px; font-weight: 600; white-space: nowrap; }
  .tc-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: #27C174; }

  /* FingerprintSurface */
  .fp-section { }
  .fp-summary { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 13px; }
  .fp-count-exposed { font-size: 20px; font-weight: 700; color: #FF4B6E; }
  .fp-count-blocked { font-size: 20px; font-weight: 700; color: #27C174; }
  .fp-count-label { color: #8892A4; }
  .fp-summary-sep { color: #8892A4; }
  .fp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .fp-item { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 12px; text-align: center; }
  .fp-exposed { border-color: rgba(255,75,110,0.3); background: rgba(255,75,110,0.05); }
  .fp-blocked { border-color: rgba(39,193,116,0.3); background: rgba(39,193,116,0.05); }
  .fp-icon { font-size: 24px; margin-bottom: 6px; }
  .fp-label { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .fp-status { font-size: 11px; font-weight: 600; }
  .fp-status-exposed { color: #FF4B6E; }
  .fp-status-blocked { color: #27C174; }
`;

export default function AuditReport() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetUrl = (() => {
    try {
      return new URLSearchParams(window.location.search).get('url') ?? '';
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    if (!targetUrl) {
      setError('No URL provided. Use guardhero://audit?url=https://example.com');
      setLoading(false);
      return;
    }

    // In production: window.chrome.guardhero.runAudit(targetUrl)
    // In dev mode, simulate a 1.5s load and return mock data.
    const timer = setTimeout(() => {
      try {
        new URL(targetUrl);
        setReport(mockAuditResult(targetUrl));
        setLoading(false);
      } catch {
        setError(`Invalid URL: ${targetUrl}`);
        setLoading(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [targetUrl]);

  return (
    <>
      <style>{css}</style>
      <div className="audit-root">
        <div className="audit-toolbar">
          <span className="audit-toolbar-title">🛡 Guard Hero Privacy Audit</span>
          {report && (
            <>
              <button
                className="audit-export-btn"
                onClick={() => report && exportAsJson(report)}
              >
                Export JSON
              </button>
              <button
                className="audit-export-btn primary"
                onClick={exportAsPdf}
              >
                Export PDF
              </button>
            </>
          )}
        </div>

        {loading && (
          <div className="audit-loading">
            <div className="audit-spinner" />
            <div>Running privacy audit for {targetUrl}</div>
            <div style={{ fontSize: 12 }}>Loading page, collecting requests…</div>
          </div>
        )}

        {error && (
          <div className="audit-error">
            <div style={{ fontSize: 32 }}>⚠</div>
            <div>{error}</div>
          </div>
        )}

        {report && (
          <>
            {/* Header */}
            <div className="audit-header">
              <div className="audit-url">{report.url}</div>
              <div className="audit-stats-row">
                <div className="audit-stat">
                  <span className="audit-stat-value">{report.totalRequests}</span>
                  <span className="audit-stat-label">Total requests</span>
                </div>
                <div className="audit-stat">
                  <span className="audit-stat-value stat-blocked">
                    {report.blockedRequests}
                  </span>
                  <span className="audit-stat-label">Blocked</span>
                </div>
                <div className="audit-stat">
                  <span className="audit-stat-value stat-warn">
                    {report.thirdPartyPercent.toFixed(0)}%
                  </span>
                  <span className="audit-stat-label">Third-party</span>
                </div>
                <div className="audit-stat">
                  <span className="audit-stat-value stat-green">
                    {formatBytes(report.bytesSaved)}
                  </span>
                  <span className="audit-stat-label">Bytes saved</span>
                </div>
              </div>
            </div>

            {/* Tracker breakdown */}
            <div className="audit-section">
              <div className="audit-section-title">
                <span className="section-icon">📊</span>
                Tracker Breakdown
              </div>
              <TrackerBreakdown
                trackersByCategory={report.trackersByCategory}
              />
            </div>

            {/* Fingerprinting surface */}
            <div className="audit-section">
              <div className="audit-section-title">
                <span className="section-icon">🔍</span>
                Fingerprinting Surface
              </div>
              <FingerprintSurface surface={report.fingerprintSurface} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
