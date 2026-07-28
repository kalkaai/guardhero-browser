// Copyright (c) 2025 Guard Hero. All rights reserved.
// Settings App — guardhero://settings

import '../mocks/chrome-guardhero';
import { useState } from 'react';
import { PrivacySettings }    from './sections/PrivacySettings';
import { EagleEyeSettings }   from './sections/EagleEyeSettings';
import { SearchSettings }     from './sections/SearchSettings';
import { AppearanceSettings } from './sections/AppearanceSettings';
import { AboutSection }       from './sections/AboutSection';
import DeveloperSettings      from './sections/DeveloperSettings';

type SettingsSection = 'privacy' | 'eagleeye' | 'search' | 'appearance' | 'developer' | 'about';

const SECTIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'privacy',    label: 'Privacy',    icon: '🔒' },
  { id: 'eagleeye',   label: 'EagleEye',   icon: '🦅' },
  { id: 'search',     label: 'Search',     icon: '🔍' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'developer',  label: 'Developer',  icon: '⚙️' },
  { id: 'about',      label: 'About',      icon: 'ℹ️' },
];

const css = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0A0E1A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .settings-root{display:flex;min-height:100vh}
  .settings-sidebar{width:220px;border-right:1px solid rgba(255,255,255,0.08);padding:24px 0;
                     background:#111827;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto}
  .settings-sidebar-logo{padding:0 20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);
                           margin-bottom:8px;font-size:13px;font-weight:600;color:#8892A4;
                           text-transform:uppercase;letter-spacing:0.08em}
  .settings-nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;
                      cursor:pointer;color:#8892A4;transition:all 0.15s;border-radius:0;
                      width:100%;text-align:left;background:none;border:none;font-size:14px}
  .settings-nav-item:hover{color:#fff;background:rgba(255,255,255,0.04)}
  .settings-nav-item.active{color:#00D4FF;background:rgba(0,212,255,0.08);
                              border-right:2px solid #00D4FF}
  .settings-content{flex:1;max-width:720px;padding:40px 48px;overflow-y:auto}
  .settings-section{margin-bottom:48px}
  .settings-section-title{font-size:22px;font-weight:700;margin-bottom:24px;color:#fff}
  .settings-group{margin-bottom:24px;background:#111827;border:1px solid rgba(255,255,255,0.08);
                   border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px}
  .settings-group-title{font-size:12px;font-weight:600;color:#8892A4;text-transform:uppercase;
                          letter-spacing:0.08em;margin-bottom:4px}
  .settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px}
  .settings-row-info{flex:1}
  .settings-row-label{display:block;font-size:14px;font-weight:500;color:#fff}
  .settings-row-desc{display:block;font-size:12px;color:#8892A4;margin-top:2px}
  .settings-toggle{width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;
                    position:relative;transition:background 0.2s;flex-shrink:0}
  .settings-toggle.on{background:#00D4FF}
  .settings-toggle.off{background:#374151}
  .settings-toggle-thumb{position:absolute;top:4px;width:16px;height:16px;border-radius:50%;
                           background:#fff;transition:left 0.15s}
  .settings-toggle.on .settings-toggle-thumb{left:24px}
  .settings-toggle.off .settings-toggle-thumb{left:4px}
  .settings-radio-row{display:flex;align-items:center;gap:12px;cursor:pointer;
                        padding:6px 0;color:#ccc}
  .settings-info-row{display:flex;justify-content:space-between;padding:6px 0;
                       border-bottom:1px solid rgba(255,255,255,0.06)}
  .settings-info-grid{border-radius:8px;overflow:hidden}
  .settings-desc{color:#8892A4;font-size:13px;line-height:1.6}
  .settings-input{flex:1;padding:8px 12px;background:#0A0E1A;border:1px solid rgba(255,255,255,0.12);
                   border-radius:8px;color:#fff;font-size:13px;outline:none}
  .settings-input:focus{border-color:rgba(0,212,255,0.4)}
  .settings-input-row{display:flex;gap:8px}
  .settings-btn-primary{padding:8px 16px;background:#00D4FF;color:#0A0E1A;border:none;
                          border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;
                          transition:background 0.15s;text-decoration:none;display:inline-block}
  .settings-btn-primary:hover{background:#00AACF}
  .settings-btn-secondary{padding:8px 16px;background:transparent;color:#8892A4;
                            border:1px solid rgba(255,255,255,0.12);border-radius:8px;
                            cursor:pointer;font-size:13px;transition:all 0.15s;text-decoration:none}
  .settings-btn-secondary:hover{border-color:#fff;color:#fff}
  .settings-btn-remove{background:none;border:none;color:#FF4B6E;cursor:pointer;font-size:18px;padding:2px 6px}
  .settings-tag-row{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;
                     background:rgba(255,255,255,0.04);border-radius:6px;font-size:13px}
  a{color:#00D4FF;text-decoration:none}
  a:hover{text-decoration:underline}
`;

export default function App() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('privacy');

  const section =
    activeSection === 'privacy'    ? <PrivacySettings /> :
    activeSection === 'eagleeye'   ? <EagleEyeSettings /> :
    activeSection === 'search'     ? <SearchSettings /> :
    activeSection === 'appearance' ? <AppearanceSettings /> :
    activeSection === 'developer'  ? <DeveloperSettings /> :
    <AboutSection />;

  return (
    <>
      <style>{css}</style>
      <div className="settings-root">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-logo">Guard Hero Settings</div>
          <nav>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="settings-content">{section}</main>
      </div>
    </>
  );
}
