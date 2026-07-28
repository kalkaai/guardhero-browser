// Copyright (c) 2025 Guard Hero. All rights reserved.
// SnippetManager.tsx — Save and load named code snippets.
// Snippets are stored in chrome.storage.local.

import { useState, useEffect } from 'react';

export interface Snippet {
  id: string;
  name: string;
  description: string;
  code: string;
}

// Pre-loaded useful snippets
const BUILTIN_SNIPPETS: Snippet[] = [
  {
    id: 'builtin-cookies',
    name: 'Log all cookies',
    description: 'Parse and log all cookies for the current page',
    code: `// Log all cookies
const cookies = document.cookie
  .split(';')
  .reduce((acc, pair) => {
    const [k, v] = pair.trim().split('=');
    if (k) acc[k] = decodeURIComponent(v || '');
    return acc;
  }, {});
console.table(cookies);
cookies;`,
  },
  {
    id: 'builtin-localstorage',
    name: 'Dump localStorage',
    description: 'Output all localStorage keys and values',
    code: `// Dump localStorage
const data = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  data[key] = localStorage.getItem(key);
}
console.table(data);
data;`,
  },
  {
    id: 'builtin-forms',
    name: 'Find all forms',
    description: 'List all forms and their input fields',
    code: `// Find all forms
Array.from(document.forms).map(form => ({
  id: form.id,
  action: form.action,
  method: form.method,
  inputs: Array.from(form.elements)
    .filter(el => ['INPUT','TEXTAREA','SELECT'].includes(el.tagName))
    .map(el => ({ name: el.name, type: el.type, value: el.value }))
}));`,
  },
  {
    id: 'builtin-meta',
    name: 'Get page meta tags',
    description: 'Extract all meta tag name/property → content pairs',
    code: `// Get page meta tags
Object.fromEntries(
  Array.from(document.querySelectorAll('meta[name],meta[property]'))
    .map(el => [
      el.getAttribute('name') || el.getAttribute('property'),
      el.getAttribute('content')
    ])
);`,
  },
  {
    id: 'builtin-third-party',
    name: 'List third-party scripts',
    description: 'Show all script tags from other origins',
    code: `// List third-party scripts
const host = location.hostname;
Array.from(document.querySelectorAll('script[src]'))
  .filter(s => !s.src.includes(host) && s.src.startsWith('http'))
  .map(s => s.src);`,
  },
  {
    id: 'builtin-timing',
    name: 'Page performance timing',
    description: 'Key page load timing metrics',
    code: `// Page performance timing
const t = performance.timing;
({
  dnsLookup:       t.domainLookupEnd - t.domainLookupStart,
  tcpConnect:      t.connectEnd - t.connectStart,
  ttfb:            t.responseStart - t.requestStart,
  domParsed:       t.domInteractive - t.responseStart,
  domContentLoaded:t.domContentLoadedEventEnd - t.navigationStart,
  loadEvent:       t.loadEventEnd - t.navigationStart,
});`,
  },
];

const STORAGE_KEY = 'guardhero-snippets';

function loadUserSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Snippet[];
  } catch {
    return [];
  }
}

function saveUserSnippets(snippets: Snippet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch {
    // Ignore storage errors
  }
}

function newId(): string {
  return 'user-' + Math.random().toString(36).slice(2);
}

interface Props {
  currentCode: string;
  onLoadSnippet: (code: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SnippetManager({
  currentCode,
  onLoadSnippet,
  isOpen,
  onClose,
}: Props) {
  const [userSnippets, setUserSnippets] = useState<Snippet[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [activeTab, setActiveTab] = useState<'builtin' | 'saved'>('builtin');

  useEffect(() => {
    setUserSnippets(loadUserSnippets());
  }, []);

  const handleSave = () => {
    if (!newName.trim()) return;
    const snippet: Snippet = {
      id: newId(),
      name: newName.trim(),
      description: newDesc.trim(),
      code: currentCode,
    };
    const updated = [...userSnippets, snippet];
    setUserSnippets(updated);
    saveUserSnippets(updated);
    setNewName('');
    setNewDesc('');
  };

  const handleDelete = (id: string) => {
    const updated = userSnippets.filter((s) => s.id !== id);
    setUserSnippets(updated);
    saveUserSnippets(updated);
  };

  if (!isOpen) return null;

  const snippets = activeTab === 'builtin' ? BUILTIN_SNIPPETS : userSnippets;

  return (
    <div className="sm-overlay">
      <div className="sm-modal">
        <div className="sm-header">
          <span className="sm-title">Snippets</span>
          <button className="sm-close" onClick={onClose}>✕</button>
        </div>
        <div className="sm-tabs">
          <button
            className={`sm-tab${activeTab === 'builtin' ? ' active' : ''}`}
            onClick={() => setActiveTab('builtin')}
          >
            Built-in
          </button>
          <button
            className={`sm-tab${activeTab === 'saved' ? ' active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            Saved ({userSnippets.length})
          </button>
        </div>
        <div className="sm-list">
          {snippets.length === 0 ? (
            <div className="sm-empty">No saved snippets</div>
          ) : (
            snippets.map((s) => (
              <div key={s.id} className="sm-item">
                <div className="sm-item-info">
                  <div className="sm-item-name">{s.name}</div>
                  <div className="sm-item-desc">{s.description}</div>
                </div>
                <div className="sm-item-actions">
                  <button
                    className="sm-load-btn"
                    onClick={() => {
                      onLoadSnippet(s.code);
                      onClose();
                    }}
                  >
                    Load
                  </button>
                  {activeTab === 'saved' && (
                    <button
                      className="sm-del-btn"
                      onClick={() => handleDelete(s.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {activeTab === 'saved' && (
          <div className="sm-save-form">
            <input
              className="sm-input"
              placeholder="Snippet name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="sm-input"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <button
              className="sm-save-btn"
              onClick={handleSave}
              disabled={!newName.trim()}
            >
              Save current code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
