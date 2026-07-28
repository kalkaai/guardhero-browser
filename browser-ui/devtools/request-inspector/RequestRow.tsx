// Copyright (c) 2025 Guard Hero. All rights reserved.
// RequestRow.tsx — Single row in the request inspector table.

import { RequestEvent } from '../../mocks/chrome-guardhero';

interface Props {
  event: RequestEvent;
  isSelected: boolean;
  onSelect: (event: RequestEvent) => void;
}

function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  try {
    const u = new URL(url);
    const base = u.hostname + u.pathname;
    return base.length > maxLen ? base.slice(0, maxLen) + '…' : base;
  } catch {
    return url.slice(0, maxLen) + '…';
  }
}

function DecisionBadge({ decision }: { decision: RequestEvent['decision'] }) {
  const styles: Record<RequestEvent['decision'], string> = {
    BLOCKED: 'badge badge-blocked',
    ALLOWED: 'badge badge-allowed',
    MODIFIED: 'badge badge-modified',
  };
  return <span className={styles[decision]}>{decision}</span>;
}

function httpStatusDisplay(event: RequestEvent): string {
  if (event.decision === 'BLOCKED') return '—';
  // In production the event would carry a status field from the network layer.
  return '200';
}

export function RequestRow({ event, isSelected, onSelect }: Props) {
  return (
    <tr
      className={`request-row${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(event)}
    >
      <td className="url-cell" title={event.url}>
        {truncateUrl(event.url)}
      </td>
      <td className="type-cell">{event.type}</td>
      <td className="status-cell">{httpStatusDisplay(event)}</td>
      <td className="decision-cell">
        <DecisionBadge decision={event.decision} />
      </td>
    </tr>
  );
}
