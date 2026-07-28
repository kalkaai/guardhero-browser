// Copyright (c) 2025 Guard Hero. All rights reserved.
// FingerprintSurface.tsx — Grid of fingerprinting APIs detected on the page.

import { FingerprintSurfaceData } from './ReportExporter';

interface Props {
  surface: FingerprintSurfaceData;
}

interface FpEntry {
  key: keyof FingerprintSurfaceData;
  label: string;
  icon: string;
  description: string;
}

const FP_ENTRIES: FpEntry[] = [
  {
    key: 'canvas',
    label: 'Canvas',
    icon: '🖼',
    description: 'Canvas fingerprinting via 2D rendering context',
  },
  {
    key: 'webgl',
    label: 'WebGL',
    icon: '🎮',
    description: 'GPU/renderer fingerprinting via WebGL context',
  },
  {
    key: 'audioContext',
    label: 'AudioContext',
    icon: '🎵',
    description: 'Audio stack fingerprinting via AudioContext',
  },
  {
    key: 'fonts',
    label: 'Font Enumeration',
    icon: '🔤',
    description: 'Installed font enumeration via CSS metrics',
  },
  {
    key: 'screen',
    label: 'Screen Resolution',
    icon: '📺',
    description: 'Screen dimensions, colour depth, pixel density',
  },
  {
    key: 'battery',
    label: 'Battery API',
    icon: '🔋',
    description: 'Battery level and charge status (deprecated)',
  },
  {
    key: 'networkInfo',
    label: 'Network Info',
    icon: '📡',
    description: 'Network connection type and bandwidth estimate',
  },
  {
    key: 'webrtc',
    label: 'WebRTC',
    icon: '🔗',
    description: 'Local IP address leakage via RTCPeerConnection',
  },
];

export function FingerprintSurface({ surface }: Props) {
  const blockedCount = FP_ENTRIES.filter((e) => !surface[e.key]).length;
  const exposedCount = FP_ENTRIES.filter((e) => surface[e.key]).length;

  return (
    <div className="fp-section">
      <div className="fp-summary">
        <span className="fp-summary-item">
          <span className="fp-count-exposed">{exposedCount}</span>
          <span className="fp-count-label"> exposed</span>
        </span>
        <span className="fp-summary-sep">·</span>
        <span className="fp-summary-item">
          <span className="fp-count-blocked">{blockedCount}</span>
          <span className="fp-count-label"> blocked by Guard Hero</span>
        </span>
      </div>

      <div className="fp-grid">
        {FP_ENTRIES.map((entry) => {
          const exposed = surface[entry.key];
          return (
            <div
              key={entry.key}
              className={`fp-item ${exposed ? 'fp-exposed' : 'fp-blocked'}`}
              title={entry.description}
            >
              <div className="fp-icon">{entry.icon}</div>
              <div className="fp-label">{entry.label}</div>
              <div className={`fp-status ${exposed ? 'fp-status-exposed' : 'fp-status-blocked'}`}>
                {exposed ? 'Exposed' : '🛡 Blocked'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
