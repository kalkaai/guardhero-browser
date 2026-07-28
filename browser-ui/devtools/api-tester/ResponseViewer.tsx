// Copyright (c) 2025 Guard Hero. All rights reserved.
// ResponseViewer.tsx — Shows the HTTP response with syntax highlighting.

import { useState } from 'react';
import { ResponseData } from './useRequestSender';

type ViewTab = 'pretty' | 'raw' | 'headers';

interface Props {
  response: ResponseData | null;
  loading: boolean;
  error: string | null;
  blockedWarning?: string | null;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return '#27C174';
  if (status >= 300 && status < 400) return '#FFB800';
  return '#FF4B6E';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const indent = depth * 16;

  if (data === null) {
    return <span style={{ color: '#8892A4' }}>null</span>;
  }
  if (typeof data === 'boolean') {
    return <span style={{ color: '#FFB800' }}>{String(data)}</span>;
  }
  if (typeof data === 'number') {
    return <span style={{ color: '#27C174' }}>{data}</span>;
  }
  if (typeof data === 'string') {
    return <span style={{ color: '#FFA07A' }}>"{data}"</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#8892A4' }}>[]</span>;
    return (
      <span>
        <button
          className="json-toggle"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        {collapsed ? (
          <span style={{ color: '#8892A4', marginLeft: 4 }}>
            [{data.length} items]
          </span>
        ) : (
          <div style={{ marginLeft: indent + 16 }}>
            {data.map((item, i) => (
              <div key={i}>
                <JsonTree data={item} depth={depth + 1} />
                {i < data.length - 1 && (
                  <span style={{ color: '#8892A4' }}>,</span>
                )}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0)
      return <span style={{ color: '#8892A4' }}>{'{}'}</span>;
    return (
      <span>
        <button
          className="json-toggle"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        {collapsed ? (
          <span style={{ color: '#8892A4', marginLeft: 4 }}>
            {'{'}
            {entries.length} keys{'}'}
          </span>
        ) : (
          <div style={{ marginLeft: indent + 16 }}>
            {entries.map(([k, v], i) => (
              <div key={k}>
                <span style={{ color: '#00D4FF' }}>"{k}"</span>
                <span style={{ color: '#8892A4' }}>: </span>
                <JsonTree data={v} depth={depth + 1} />
                {i < entries.length - 1 && (
                  <span style={{ color: '#8892A4' }}>,</span>
                )}
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span>{String(data)}</span>;
}

export function ResponseViewer({
  response,
  loading,
  error,
  blockedWarning,
}: Props) {
  const [activeTab, setActiveTab] = useState<ViewTab>('pretty');

  if (loading) {
    return (
      <div className="rv-root rv-loading">
        <div className="rv-spinner" />
        <span>Sending request…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rv-root rv-error">
        <div className="rv-error-icon">⚠</div>
        <div className="rv-error-msg">{error}</div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="rv-root rv-empty">
        {blockedWarning && (
          <div className="rv-blocked-warning">
            <span className="rv-warning-icon">🛡</span>
            <span>{blockedWarning}</span>
          </div>
        )}
        <span className="rv-placeholder">
          Send a request to see the response
        </span>
      </div>
    );
  }

  return (
    <div className="rv-root">
      {blockedWarning && (
        <div className="rv-blocked-warning">
          <span className="rv-warning-icon">🛡</span>
          <span>{blockedWarning}</span>
        </div>
      )}

      <div className="rv-status-bar">
        <span
          className="rv-status-code"
          style={{ color: statusColor(response.status) }}
        >
          {response.status} {response.statusText}
        </span>
        <span className="rv-stat">{response.timeMs}ms</span>
        <span className="rv-stat">{formatBytes(response.sizeBytes)}</span>
      </div>

      <div className="rv-tabs">
        {(['pretty', 'raw', 'headers'] as ViewTab[]).map((tab) => (
          <button
            key={tab}
            className={`rv-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="rv-content">
        {activeTab === 'pretty' && (
          <div className="rv-json-tree">
            {response.isJson && response.parsedJson !== undefined ? (
              <JsonTree data={response.parsedJson} />
            ) : (
              <pre className="rv-raw-text">{response.body}</pre>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <pre className="rv-raw-text">{response.body}</pre>
        )}

        {activeTab === 'headers' && (
          <table className="rv-headers-table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(response.headers).map(([k, v]) => (
                <tr key={k}>
                  <td className="header-name">{k}</td>
                  <td className="header-value">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
