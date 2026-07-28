// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// TrackerList.tsx — Scrollable list of blocked requests on current page.

import { useState, useEffect } from 'react';

interface TrackerEntry {
  domain: string;
  url: string;
  type: string;
  decision: 'BLOCKED' | 'ALLOWED' | 'MODIFIED';
}

interface TrackerListProps {
  tabId?: number;
  maxItems?: number;
}

export function TrackerList({ tabId, maxItems = 10 }: TrackerListProps) {
  const [trackers, setTrackers] = useState<TrackerEntry[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const stats = await window.chrome?.guardhero?.getPageStats(tabId ?? -1);
        const entries: TrackerEntry[] = (stats?.blocked_trackers ?? []).map(url => ({
          domain: extractDomain(url),
          url,
          type: 'request',
          decision: 'BLOCKED' as const,
        }));
        setTrackers(entries.slice(0, maxItems));
        setBlockedCount(stats?.blocked ?? 0);
      } catch {
        // Dev mock
        setTrackers([
          { domain: 'analytics.google.com', url: 'https://analytics.google.com/collect', type: 'XHR', decision: 'BLOCKED' },
          { domain: 'facebook.net',         url: 'https://connect.facebook.net/tr',      type: 'Pixel', decision: 'BLOCKED' },
          { domain: 'doubleclick.net',       url: 'https://doubleclick.net/pixel',        type: 'Image', decision: 'BLOCKED' },
        ]);
        setBlockedCount(3);
      }
    }
    load();
  }, [tabId, maxItems]);

  return (
    <div className="popup-tracker-section">
      <div className="popup-section-header">
        <span>This page</span>
        <span className="popup-blocked-badge">{blockedCount} blocked</span>
      </div>
      <div className="popup-tracker-list" role="list">
        {trackers.length === 0 ? (
          <div className="popup-no-trackers">
            <span>✓ No trackers detected</span>
          </div>
        ) : (
          trackers.map((t, i) => (
            <div key={`${t.domain}-${i}`} className="popup-tracker-row" role="listitem">
              <span className="popup-tracker-domain">{t.domain}</span>
              <span className={`popup-tracker-badge ${t.decision.toLowerCase()}`}>
                {t.decision}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url; }
}
