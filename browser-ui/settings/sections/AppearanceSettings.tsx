// Copyright (c) 2025 Guard Hero. All rights reserved.
// AppearanceSettings.tsx — Theme and NTP customization.

import { useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [showClock, setShowClock] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showTopSites, setShowTopSites] = useState(true);

  return (
    <section className="settings-section" id="appearance">
      <h2 className="settings-section-title">Appearance</h2>

      <div className="settings-group">
        <h3 className="settings-group-title">Theme</h3>
        {(['dark', 'light', 'system'] as Theme[]).map(t => (
          <label key={t} className="settings-radio-row">
            <input type="radio" name="theme" value={t}
                   checked={theme === t} onChange={() => setTheme(t)} />
            <span className="settings-row-label" style={{ textTransform: 'capitalize' }}>{t}</span>
          </label>
        ))}
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">New Tab Page</h3>
        {[
          { label: 'Show clock', val: showClock, set: setShowClock },
          { label: 'Show blocking stats', val: showStats, set: setShowStats },
          { label: 'Show top sites', val: showTopSites, set: setShowTopSites },
        ].map(({ label, val, set }) => (
          <label key={label} className="settings-radio-row">
            <input type="checkbox" checked={val} onChange={() => set(!val)} />
            <span className="settings-row-label">{label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
