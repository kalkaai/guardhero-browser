// Copyright (c) 2025 Guard Hero. All rights reserved.
// RequestInspector.tsx — Main container for the DevMode Request Inspector.

import '../../mocks/chrome-guardhero';
import { useState } from 'react';
import { RequestEvent } from '../../mocks/chrome-guardhero';
import { useRequestStream, RequestFilter } from './useRequestStream';
import { RequestRow } from './RequestRow';
import { RequestDetail } from './RequestDetail';

const FILTER_OPTIONS: { value: RequestFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'blocked',  label: 'Blocked' },
  { value: 'allowed',  label: 'Allowed' },
  { value: 'modified', label: 'Modified' },
];

const css = `
  .ri-root { display: flex; flex-direction: column; height: 100%; background: var(--bg, #0A0E1A); color: var(--text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
  .ri-toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .ri-title { font-weight: 700; font-size: 14px; color: var(--text, #fff); flex: 1; }
  .ri-filter-group { display: flex; gap: 4px; }
  .ri-filter-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8892A4; cursor: pointer; font-size: 12px; transition: all 0.15s; }
  .ri-filter-btn.active { background: rgba(0,212,255,0.12); color: var(--accent, #00D4FF); border-color: var(--accent, #00D4FF); }
  .ri-filter-btn:hover:not(.active) { color: #fff; border-color: rgba(255,255,255,0.3); }
  .ri-clear-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8892A4; cursor: pointer; font-size: 12px; }
  .ri-clear-btn:hover { color: #fff; }
  .ri-count { font-size: 11px; color: #8892A4; }
  .ri-table-wrap { flex: 1; overflow-y: auto; min-height: 0; }
  table.ri-table { width: 100%; border-collapse: collapse; }
  .ri-table thead th { padding: 7px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: #0D1120; z-index: 1; }
  .ri-table .url-cell  { width: 45%; padding: 7px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 0; }
  .ri-table .type-cell { width: 10%; padding: 7px 12px; color: #8892A4; }
  .ri-table .status-cell { width: 8%; padding: 7px 12px; color: #8892A4; }
  .ri-table .decision-cell { width: 15%; padding: 7px 12px; }
  .request-row { cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
  .request-row:hover { background: rgba(255,255,255,0.03); }
  .request-row.selected { background: rgba(0,212,255,0.07); }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .badge-blocked  { background: rgba(255,75,110,0.15); color: var(--blocked, #FF4B6E); }
  .badge-allowed  { background: rgba(39,193,116,0.15); color: #27C174; }
  .badge-modified { background: rgba(255,184,0,0.15); color: #FFB800; }
  .ri-detail-pane { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.08); background: #0D1120; max-height: 240px; overflow-y: auto; }
  .request-detail { padding: 12px 16px; }
  .request-detail.empty { display: flex; align-items: center; justify-content: center; height: 80px; }
  .detail-placeholder { color: #8892A4; font-size: 12px; }
  .detail-section { margin-bottom: 12px; }
  .detail-label { font-size: 10px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .detail-url { font-size: 12px; word-break: break-all; color: #E2E8F0; }
  .detail-params { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 3px; }
  .param-row { display: flex; gap: 6px; font-size: 12px; }
  .param-key { color: var(--accent, #00D4FF); }
  .param-colon { color: #8892A4; }
  .param-val { color: #E2E8F0; }
  .detail-reason { font-size: 12px; color: #E2E8F0; }
  .cname-chain { font-size: 12px; }
  .cname-hop { color: #E2E8F0; }
  .cname-arrow { color: var(--blocked, #FF4B6E); }
  .detail-meta-row { display: flex; gap: 24px; }
  .detail-meta { display: flex; gap: 6px; align-items: center; }
  .meta-label { font-size: 10px; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; }
  .meta-val { font-size: 12px; color: #E2E8F0; }
  .dim { color: #8892A4; }
  .ri-empty { display: flex; align-items: center; justify-content: center; height: 200px; color: #8892A4; font-size: 13px; }
`;

export default function RequestInspector() {
  const { filteredEvents, filter, setFilter, clearEvents, events } =
    useRequestStream();
  const [selectedEvent, setSelectedEvent] = useState<RequestEvent | null>(null);

  return (
    <>
      <style>{css}</style>
      <div className="ri-root">
        {/* Toolbar */}
        <div className="ri-toolbar">
          <span className="ri-title">Request Inspector</span>
          <div className="ri-filter-group">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`ri-filter-btn${filter === opt.value ? ' active' : ''}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="ri-count">
            {filteredEvents.length} / {events.length}
          </span>
          <button className="ri-clear-btn" onClick={clearEvents}>
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="ri-table-wrap">
          {filteredEvents.length === 0 ? (
            <div className="ri-empty">
              {events.length === 0
                ? 'Waiting for requests…'
                : 'No requests match the current filter'}
            </div>
          ) : (
            <table className="ri-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Guard Hero</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event, i) => (
                  <RequestRow
                    key={`${event.url}-${event.timestamp}-${i}`}
                    event={event}
                    isSelected={selectedEvent === event}
                    onSelect={setSelectedEvent}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail pane */}
        <div className="ri-detail-pane">
          <RequestDetail event={selectedEvent} />
        </div>
      </div>
    </>
  );
}
