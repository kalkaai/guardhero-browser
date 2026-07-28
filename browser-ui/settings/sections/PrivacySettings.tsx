// Copyright (c) 2025 Guard Hero. All rights reserved.
// PrivacySettings.tsx — Privacy & tracking protection settings section.

import { useState } from 'react';

interface ToggleRowProps {
  label: string;
  description: string;
  defaultValue?: boolean;
  onChange?: (v: boolean) => void;
}

function ToggleRow({ label, description, defaultValue = true, onChange }: ToggleRowProps) {
  const [value, setValue] = useState(defaultValue);
  function toggle() {
    setValue(!value);
    onChange?.(!value);
  }
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-desc">{description}</span>
      </div>
      <button className={`settings-toggle ${value ? 'on' : 'off'}`} onClick={toggle}
              role="switch" aria-checked={value}>
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  );
}

export function PrivacySettings() {
  return (
    <section className="settings-section" id="privacy">
      <h2 className="settings-section-title">Privacy</h2>

      <div className="settings-group">
        <h3 className="settings-group-title">Cookies</h3>
        <ToggleRow
          label="Block third-party cookies"
          description="Prevent cross-site tracking via cookies"
          defaultValue={true}
        />
        <ToggleRow
          label="Send Do Not Track header"
          description="Request sites not to track you (not legally binding)"
          defaultValue={true}
        />
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Fingerprinting Protection</h3>
        <ToggleRow
          label="Canvas fingerprint noise"
          description="Add subtle noise to canvas readback to prevent tracking"
          defaultValue={true}
        />
        <ToggleRow
          label="Block Battery Status API"
          description="Prevent access to navigator.getBattery()"
          defaultValue={true}
        />
        <ToggleRow
          label="Block Network Information API"
          description="Prevent access to navigator.connection"
          defaultValue={true}
        />
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Network</h3>
        <ToggleRow
          label="Disable hyperlink auditing"
          description="Block &lt;a ping&gt; attribute tracking"
          defaultValue={true}
        />
        <ToggleRow
          label="Force WebRTC privacy"
          description="Disable non-proxied UDP to prevent IP leakage"
          defaultValue={true}
        />
        <ToggleRow
          label="Disable prefetch / preconnect"
          description="Prevent speculative connections to third-party domains"
          defaultValue={false}
        />
      </div>
    </section>
  );
}
