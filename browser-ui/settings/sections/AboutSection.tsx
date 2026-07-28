// Copyright (c) 2025 Guard Hero. All rights reserved.
// AboutSection.tsx — Version info, update status, changelog.

export function AboutSection() {
  const GH_VERSION  = '1.0.0';
  const CR_VERSION  = '130.0.6723.116';
  const UPDATE_DATE = '2025-01-15';

  return (
    <section className="settings-section" id="about">
      <h2 className="settings-section-title">About Guard Hero Browser</h2>

      <div className="settings-group">
        <div className="settings-info-grid">
          <div className="settings-info-row"><span>Guard Hero version</span><strong>v{GH_VERSION}</strong></div>
          <div className="settings-info-row"><span>Chromium base</span><strong>{CR_VERSION}</strong></div>
          <div className="settings-info-row"><span>Last updated</span><strong>{UPDATE_DATE}</strong></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button className="settings-btn-primary">Check for updates</button>
          <a href="https://guardhero.app/changelog" target="_blank" rel="noopener"
             className="settings-btn-secondary">Changelog</a>
        </div>
      </div>

      <div className="settings-group">
        <h3 className="settings-group-title">Privacy Promise</h3>
        <p className="settings-desc">
          Guard Hero Browser is privacy-first. No data leaves your device without your explicit action.
          EagleEye runs entirely locally. AI models run on-device when you use local providers.
          The only network connection required is the update server — and even that can be disabled.
        </p>
        <p className="settings-desc" style={{ marginTop:8 }}>
          <a href="https://guardhero.app/privacy" target="_blank" rel="noopener">Privacy Policy</a>
          {' · '}
          <a href="https://github.com/guardhero/guardhero-browser" target="_blank" rel="noopener">Source on GitHub</a>
        </p>
      </div>
    </section>
  );
}
