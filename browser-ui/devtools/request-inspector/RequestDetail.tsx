// Copyright (c) 2025 Guard Hero. All rights reserved.
// RequestDetail.tsx — Detail pane for a selected request event.

import { RequestEvent } from '../../mocks/chrome-guardhero';

interface Props {
  event: RequestEvent | null;
}

function parseQueryParams(url: string): Record<string, string> {
  try {
    const params: Record<string, string> = {};
    new URL(url).searchParams.forEach((v, k) => {
      params[k] = v;
    });
    return params;
  } catch {
    return {};
  }
}

export function RequestDetail({ event }: Props) {
  if (!event) {
    return (
      <div className="request-detail empty">
        <span className="detail-placeholder">Select a request to see details</span>
      </div>
    );
  }

  const queryParams = parseQueryParams(event.url);
  const hasStripped = event.stripped_params.length > 0;
  const hasCname = event.cname_chain.length > 0;

  return (
    <div className="request-detail">
      <div className="detail-section">
        <div className="detail-label">Full URL</div>
        <div className="detail-url">{event.url}</div>
      </div>

      {hasStripped && (
        <div className="detail-section">
          <div className="detail-label">Would have sent (stripped params)</div>
          <div className="detail-params">
            {event.stripped_params.map((param) => {
              const [key, val] = param.split('=');
              return (
                <div key={param} className="param-row">
                  <span className="param-key">{key}</span>
                  <span className="param-colon">:</span>
                  <span className="param-val">{val ?? ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(queryParams).length > 0 && !hasStripped && (
        <div className="detail-section">
          <div className="detail-label">Query parameters</div>
          <div className="detail-params">
            {Object.entries(queryParams).map(([k, v]) => (
              <div key={k} className="param-row">
                <span className="param-key">{k}</span>
                <span className="param-colon">:</span>
                <span className="param-val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <div className="detail-label">Block / modify reason</div>
        <div className="detail-reason">
          {event.reason || <span className="dim">—</span>}
        </div>
      </div>

      {hasCname && (
        <div className="detail-section">
          <div className="detail-label">CNAME chain</div>
          <div className="cname-chain">
            {event.cname_chain.map((hop, i) => (
              <span key={i}>
                <span className="cname-hop">{hop}</span>
                {i < event.cname_chain.length - 1 && (
                  <span className="cname-arrow"> → </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section detail-meta-row">
        <div className="detail-meta">
          <span className="meta-label">Tab ID</span>
          <span className="meta-val">{event.tab_id}</span>
        </div>
        <div className="detail-meta">
          <span className="meta-label">Time</span>
          <span className="meta-val">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="detail-meta">
          <span className="meta-label">Type</span>
          <span className="meta-val">{event.type}</span>
        </div>
      </div>
    </div>
  );
}
