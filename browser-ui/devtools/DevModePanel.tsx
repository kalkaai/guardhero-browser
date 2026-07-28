import { useState } from 'react';
import RequestInspector from './request-inspector/RequestInspector';
import ApiTester from './api-tester/ApiTester';
import Scratchpad from './scratchpad/Scratchpad';
import StorageManager from './storage-manager/StorageManager';
import HeaderEditor from './header-editor/HeaderEditor';

type Tab = 'inspector' | 'api' | 'scratchpad' | 'storage' | 'headers';

const TABS: { id: Tab; label: string }[] = [
  { id: 'inspector', label: 'Request Inspector' },
  { id: 'api',       label: 'API Tester' },
  { id: 'scratchpad',label: 'Scratchpad' },
  { id: 'storage',   label: 'Storage' },
  { id: 'headers',   label: 'Headers' },
];

export default function DevModePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('inspector');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg, #0A0E1A)',
      color: 'var(--text, #FFFFFF)',
      fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0D1220',
        padding: '0 8px',
        gap: '2px',
        flexShrink: 0,
      }}>
        <span style={{
          marginRight: '12px',
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--accent, #00D4FF)',
          letterSpacing: '0.04em',
        }}>🛡 DevMode</span>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? 'rgba(0,212,255,0.12)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent, #00D4FF)' : 'rgba(255,255,255,0.6)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent, #00D4FF)' : '2px solid transparent',
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'inspector'  && <RequestInspector />}
        {activeTab === 'api'        && <ApiTester />}
        {activeTab === 'scratchpad' && <Scratchpad />}
        {activeTab === 'storage'    && <StorageManager />}
        {activeTab === 'headers'    && <HeaderEditor />}
      </div>
    </div>
  );
}
