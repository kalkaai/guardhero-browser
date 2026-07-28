// Copyright (c) 2025 Guard Hero. All rights reserved.
// TrackerBreakdown.tsx — Visual breakdown of trackers by category.

import { useState } from 'react';
import { TrackerItem } from './ReportExporter';


interface CategoryConfig {
  icon: string;
  color: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  Analytics:       { icon: '📊', color: '#00D4FF' },
  Advertising:     { icon: '📢', color: '#FF4B6E' },
  Social:          { icon: '👥', color: '#B57BFF' },
  Fingerprinting:  { icon: '🔍', color: '#FFB800' },
  'CNAME-cloaked': { icon: '🕵️', color: '#FF6B35' },
  Other:           { icon: '⚙',  color: '#8892A4' },
};

function severityColor(score: number): string {
  if (score >= 70) return '#FF4B6E';
  if (score >= 40) return '#FF8C00';
  return '#FFB800';
}

function severityLabel(score: number): string {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

interface CategoryCardProps {
  category: string;
  trackers: TrackerItem[];
}

function CategoryCard({ category, trackers }: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG['Other'];
  const totalRequests = trackers.reduce((s, t) => s + t.requestCount, 0);
  const maxSeverity = Math.max(...trackers.map((t) => t.severityScore));

  return (
    <div className="tc-card">
      <div
        className="tc-card-header"
        onClick={() => setExpanded((e) => !e)}
        style={{ borderLeftColor: config.color }}
      >
        <span className="tc-cat-icon">{config.icon}</span>
        <span className="tc-cat-name">{category}</span>
        <span className="tc-cat-count">
          {trackers.length} tracker{trackers.length !== 1 ? 's' : ''}
        </span>
        <span className="tc-cat-reqs">{totalRequests} requests</span>
        <span
          className="tc-sev-badge"
          style={{ color: severityColor(maxSeverity) }}
        >
          {severityLabel(maxSeverity)}
        </span>
        <span className="tc-chevron">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div className="tc-tracker-list">
          {trackers
            .sort((a, b) => b.severityScore - a.severityScore)
            .map((tracker) => (
              <div key={tracker.domain} className="tc-tracker-row tracker-row">
                <div className="tc-tracker-info">
                  <span className="tracker-domain">{tracker.domain}</span>
                  <span className="tc-tracker-reqs">
                    {tracker.requestCount} req{tracker.requestCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="tc-severity-bar-wrap">
                  <div
                    className="severity-bar"
                    style={{
                      width: `${tracker.severityScore}%`,
                      background: severityColor(tracker.severityScore),
                    }}
                  />
                  <span
                    className="tc-severity-label"
                    style={{ color: severityColor(tracker.severityScore) }}
                  >
                    {severityLabel(tracker.severityScore)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  trackersByCategory: Record<string, TrackerItem[]>;
}

export function TrackerBreakdown({ trackersByCategory }: Props) {
  const totalTrackers = Object.values(trackersByCategory).reduce(
    (s, arr) => s + arr.length,
    0
  );

  if (totalTrackers === 0) {
    return (
      <div className="tc-empty">
        <span style={{ fontSize: 32 }}>✅</span>
        <div>No trackers detected</div>
      </div>
    );
  }

  const sortedCategories = Object.entries(trackersByCategory).sort(
    ([, a], [, b]) => b.length - a.length
  );

  return (
    <div className="tc-root">
      {sortedCategories.map(([category, trackers]) => (
        <CategoryCard key={category} category={category} trackers={trackers} />
      ))}
    </div>
  );
}
