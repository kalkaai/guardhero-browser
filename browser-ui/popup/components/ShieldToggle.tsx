// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// ShieldToggle.tsx — Toggle EagleEye blocking for the current site.

import { useState, useEffect } from 'react';

interface ShieldToggleProps {
  currentDomain?: string;
}

export function ShieldToggle({ currentDomain }: ShieldToggleProps) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if the current domain is on the allowlist
    if (window.chrome?.guardhero && currentDomain) {
      // Infer from blocking enabled state
      window.chrome.guardhero.isBlockingEnabled?.()
        .then(v => setEnabled(v))
        .catch(() => {});
    }
  }, [currentDomain]);

  async function handleToggle() {
    setLoading(true);
    try {
      const newState = !enabled;
      if (newState === false && currentDomain) {
        // Allowlist this domain when disabling
        await window.chrome?.guardhero?.allowDomain(currentDomain);
      }
      await window.chrome?.guardhero?.setBlockingEnabled(newState);
      setEnabled(newState);
    } catch (err) {
      console.error('Failed to toggle blocking', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="popup-toggle-row">
      <div className="popup-toggle-label">
        <span className={`popup-shield-dot ${enabled ? 'active' : 'paused'}`} />
        <span>EagleEye {enabled ? 'ON' : 'OFF'}</span>
      </div>
      <button
        className={`popup-toggle-btn ${enabled ? 'on' : 'off'}`}
        onClick={handleToggle}
        disabled={loading}
        aria-checked={enabled}
        role="switch"
        aria-label={`EagleEye blocking ${enabled ? 'on' : 'off'}`}
      >
        <span className="popup-toggle-thumb" />
      </button>
    </div>
  );
}
