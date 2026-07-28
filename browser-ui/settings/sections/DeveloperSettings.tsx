import React, { useState } from 'react';
import { LocalHttpsManager } from '../developer/LocalHttpsManager';

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '2px', accentColor: 'var(--accent, #00D4FF)', width: '16px', height: '16px' }}
      />
      <div>
        <div style={{ fontSize: '14px', color: 'var(--text, #fff)' }}>{label}</div>
        {description && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{description}</div>}
      </div>
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--accent, #00D4FF)',
      borderBottom: '1px solid rgba(0,212,255,0.15)',
      paddingBottom: '8px',
      marginBottom: '16px',
      marginTop: '28px',
    }}>{children}</div>
  );
}

export default function DeveloperSettings() {
  const [devmodeEnabled, setDevmodeEnabled]         = useState(true);
  const [requestInspector, setRequestInspector]     = useState(true);
  const [apiTester, setApiTester]                   = useState(true);
  const [scratchpad, setScratchpad]                 = useState(true);
  const [storageManager, setStorageManager]         = useState(true);
  const [headerEditor, setHeaderEditor]             = useState(true);
  const [devtoolsAnnotations, setDevtoolsAnnotations] = useState(false);
  const [localCaEnabled, setLocalCaEnabled]         = useState(true);
  const [aiConfidenceScores, setAiConfidenceScores] = useState(false);
  const [responseDiff, setResponseDiff]             = useState(false);

  return (
    <div style={{ padding: '24px 0' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>Developer Tools</h2>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
        DevMode panel — open with <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>Ctrl+Shift+D</kbd>
      </p>

      <SectionHeading>DevMode Panel</SectionHeading>

      <Toggle
        label="Enable DevMode panel (Ctrl+Shift+D)"
        checked={devmodeEnabled}
        onChange={setDevmodeEnabled}
      />
      <Toggle
        label="Request Inspector"
        description="Enhanced network monitor with EagleEye blocking annotations"
        checked={requestInspector}
        onChange={setRequestInspector}
      />
      <Toggle
        label="API Tester"
        description="Built-in REST client — no account, all data local"
        checked={apiTester}
        onChange={setApiTester}
      />
      <Toggle
        label="JavaScript Scratchpad"
        description="Persistent REPL that survives page navigation"
        checked={scratchpad}
        onChange={setScratchpad}
      />
      <Toggle
        label="Cookie and Storage Manager"
        description="Visual inspector for cookies, localStorage, sessionStorage, IndexedDB"
        checked={storageManager}
        onChange={setStorageManager}
      />
      <Toggle
        label="Header Editor"
        description="Modify request and response headers without an extension"
        checked={headerEditor}
        onChange={setHeaderEditor}
      />
      <Toggle
        label="Show Guard Hero annotations in standard DevTools"
        description="Adds EagleEye decision column to the Network panel"
        checked={devtoolsAnnotations}
        onChange={setDevtoolsAnnotations}
      />

      <SectionHeading>Local HTTPS</SectionHeading>
      <Toggle
        label="Enable local CA"
        description="Generates a browser-trusted CA for localhost and *.local domains"
        checked={localCaEnabled}
        onChange={setLocalCaEnabled}
      />
      {localCaEnabled && (
        <div style={{ marginTop: '8px' }}>
          <LocalHttpsManager />
        </div>
      )}

      <SectionHeading>Experimental</SectionHeading>
      <Toggle
        label="Show AI confidence scores in Request Inspector"
        description="Displays the EagleEye AI model's confidence score for each blocked request"
        checked={aiConfidenceScores}
        onChange={setAiConfidenceScores}
      />
      <Toggle
        label="Enable response diff tool (beta)"
        description="Compare responses between two selected requests side-by-side"
        checked={responseDiff}
        onChange={setResponseDiff}
      />
    </div>
  );
}
