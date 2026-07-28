// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// App.tsx — Guard Hero toolbar popup.

import '../mocks/chrome-guardhero';
import { ShieldToggle }    from './components/ShieldToggle';
import { TrackerList }     from './components/TrackerList';
import { AllowSiteButton } from './components/AllowSiteButton';
import { ReportButton }    from './components/ReportButton';

// Minimal popup styles (inline for compact bundle)
const css = `
  body { margin:0; background:#0A0E1A; color:#fff;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         font-size:13px; min-width:280px; max-width:320px; }
  .popup-header { display:flex; align-items:center; justify-content:space-between;
                  padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08); }
  .popup-title { display:flex; align-items:center; gap:8px; font-weight:600; }
  .popup-shield { color:#00D4FF; font-size:18px; }
  .popup-toggle-row { display:flex; align-items:center; justify-content:space-between; }
  .popup-toggle-label { display:flex; align-items:center; gap:8px; }
  .popup-shield-dot { width:8px;height:8px;border-radius:50%; }
  .popup-shield-dot.active { background:#00D4FF; }
  .popup-shield-dot.paused { background:#888; }
  .popup-toggle-btn { width:40px;height:22px;border-radius:11px;border:none;cursor:pointer;
                       position:relative;transition:background 0.2s; }
  .popup-toggle-btn.on { background:#00D4FF; }
  .popup-toggle-btn.off { background:#444; }
  .popup-toggle-thumb { position:absolute;top:3px;width:16px;height:16px;border-radius:50%;
                          background:#fff;transition:left 0.2s; }
  .popup-toggle-btn.on .popup-toggle-thumb { left:21px; }
  .popup-toggle-btn.off .popup-toggle-thumb { left:3px; }
  .popup-section-header { display:flex;align-items:center;justify-content:space-between;
                           padding:8px 16px;font-size:11px;color:#8892A4;text-transform:uppercase;
                           letter-spacing:0.08em; }
  .popup-blocked-badge { background:rgba(255,75,110,0.15);color:#FF4B6E;
                          padding:2px 8px;border-radius:999px;font-weight:600; }
  .popup-tracker-list { max-height:180px;overflow-y:auto; }
  .popup-tracker-row { display:flex;align-items:center;justify-content:space-between;
                        padding:6px 16px;border-bottom:1px solid rgba(255,255,255,0.04); }
  .popup-tracker-domain { font-size:12px;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px; }
  .popup-tracker-badge { font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase; }
  .popup-tracker-badge.blocked { background:rgba(255,75,110,0.15);color:#FF4B6E; }
  .popup-tracker-badge.allowed { background:rgba(0,230,118,0.12);color:#00E676; }
  .popup-no-trackers { padding:16px;text-align:center;color:#4A5568;font-size:12px; }
  .popup-footer { display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08); }
  .popup-action-btn { flex:1;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);
                       background:transparent;color:#ccc;cursor:pointer;font-size:12px;
                       transition:all 0.15s; }
  .popup-action-btn:hover { border-color:#00D4FF;color:#00D4FF; }
  .popup-action-btn.report:hover { border-color:#FF4B6E;color:#FF4B6E; }
`;

export default function App() {
  const currentDomain = 'example.com'; // In prod: from chrome.tabs.query

  return (
    <>
      <style>{css}</style>
      <div>
        {/* Header */}
        <header className="popup-header">
          <div className="popup-title">
            <span className="popup-shield">🛡</span>
            Guard Hero
          </div>
          <ShieldToggle currentDomain={currentDomain} />
        </header>

        {/* Tracker list */}
        <TrackerList maxItems={8} />

        {/* Footer actions */}
        <footer className="popup-footer">
          <AllowSiteButton domain={currentDomain} />
          <ReportButton currentUrl={`https://${currentDomain}`} />
        </footer>
      </div>
    </>
  );
}
