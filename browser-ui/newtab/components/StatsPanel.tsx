// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// StatsPanel.tsx — Session / all-time / monthly stats with animated counters.

import { useState, useEffect, useRef, useCallback } from 'react';

interface Stats {
  session: number;
  allTime: number;
  monthly: number;
}

function useAnimatedNumber(target: number, duration = 600): number {
  const [displayed, setDisplayed] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const delta = target - start;
    if (delta === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + delta * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return displayed;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

interface StatBlockProps {
  label: string;
  value: number;
}

function StatBlock({ label, value }: StatBlockProps) {
  const animated = useAnimatedNumber(value);
  return (
    <div className="ntp-stat">
      <div className="ntp-stat-label">{label}</div>
      <div className={`ntp-stat-value${value === 0 ? ' is-zero' : ''}`}
           aria-label={`${label}: ${value} blocked`}>
        {formatNumber(animated)}
      </div>
    </div>
  );
}

interface StatsPanelProps {
  refreshInterval?: number; // ms
}

export function StatsPanel({ refreshInterval = 5000 }: StatsPanelProps) {
  const [stats, setStats] = useState<Stats>({ session: 0, allTime: 0, monthly: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [session, allTime] = await Promise.all([
        window.chrome?.guardhero?.getSessionStats(),
        window.chrome?.guardhero?.getAllTimeStats(),
      ]);

      setStats({
        session:  session?.blocked  ?? 0,
        allTime:  allTime?.total_blocked ?? 0,
        monthly:  Math.round((allTime?.total_blocked ?? 0) / Math.max(1, allTime?.sessions ?? 1) * 30),
      });
    } catch {
      // chrome.guardhero not available (e.g., during dev) — use mock
      setStats({ session: 42, allTime: 18420, monthly: 3210 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(id);
  }, [fetchStats, refreshInterval]);

  if (loading) {
    return (
      <div className="ntp-stats-panel" aria-label="Loading stats">
        <div className="ntp-stat"><div className="ntp-stat-value is-zero">—</div></div>
        <div className="ntp-stat"><div className="ntp-stat-value is-zero">—</div></div>
        <div className="ntp-stat"><div className="ntp-stat-value is-zero">—</div></div>
      </div>
    );
  }

  return (
    <div className="ntp-stats-panel" role="region" aria-label="EagleEye blocking statistics">
      <StatBlock label="Session"    value={stats.session} />
      <StatBlock label="All Time"   value={stats.allTime} />
      <StatBlock label="This Month" value={stats.monthly} />
    </div>
  );
}
