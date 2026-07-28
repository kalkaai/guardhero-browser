// Copyright (c) 2025 Guard Hero. All rights reserved.
// EagleEyeSettings.tsx — EagleEye native blocker settings.

import { useState } from 'react';

type BlockingLevel = 'standard' | 'aggressive' | 'custom';

export function EagleEyeSettings() {
  const [level, setLevel] = useState<BlockingLevel>('standard');
  const [enabled, setEnabled] = useState(true);
  const [domainCount, setDomainCount] = useState(93000);
  const [allowlistDomains, setAllowlistDomains] = useState<string[]>([]);
  const [newAllowDomain, setNewAllowDomain] = useState('');

  function addAllowDomain() {
    const d = newAllowDomain.trim().toLowerCase();
    if (d && !allowlistDomains.includes(d)) {
      setAllowlistDomains(prev => [...prev, d]);
      window.chrome?.guardhero?.allowDomain(d);
      setNewAllowDomain('');
    }
  }

  return (
    <section className="settings-section" id="eagleeye">
      <h2 className="settings-section-title">EagleEye</h2>

      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">EagleEye Native Blocking</span>
            <span className="settings-row-desc">Block trackers at the network level — no extension needed</span>
          </div>
          <button className={`settings-toggle ${enabled ? 'on' : 'off'}`}
                  onClick={() => setEnabled(!enabled)} role="switch" aria-checked={enabled}>
            <span className="settings-toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Blocking Level</h3>
        {(['standard', 'aggressive', 'custom'] as BlockingLevel[]).map(l => (
          <label key={l} className="settings-radio-row">
            <input type="radio" name="blocking-level" value={l}
                   checked={level === l} onChange={() => setLevel(l)} />
            <div className="settings-row-info">
              <span className="settings-row-label" style={{ textTransform: 'capitalize' }}>{l}</span>
              <span className="settings-row-desc">{
                l === 'standard'   ? 'Block known trackers and ads' :
                l === 'aggressive' ? 'Block all third-party requests not on allowlist' :
                'Custom rules — configure below'
              }</span>
            </div>
          </label>
        ))}
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Blocklist</h3>
        <div className="settings-info-row">
          <span>{domainCount.toLocaleString()} domains blocked</span>
          <button className="settings-btn-secondary"
                  onClick={() => setDomainCount(93412)}>
            Update list
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Site Allowlist</h3>
        <p className="settings-desc">EagleEye will not block requests from these domains.</p>
        <div className="settings-input-row">
          <input className="settings-input" type="text" placeholder="example.com"
                 value={newAllowDomain} onChange={e => setNewAllowDomain(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addAllowDomain()} />
          <button className="settings-btn-primary" onClick={addAllowDomain}>Add</button>
        </div>
        {allowlistDomains.map(d => (
          <div key={d} className="settings-tag-row">
            <span>{d}</span>
            <button className="settings-btn-remove"
                    onClick={() => setAllowlistDomains(prev => prev.filter(x => x !== d))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
