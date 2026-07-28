// Copyright (c) 2025 Guard Hero. All rights reserved.
// HeaderEditor.tsx — Main container for the DevMode Header Editor.
// Rules are saved to chrome.storage.local and pushed to the native
// header_modifier via chrome.guardhero.setHeaderRules([...]).

import '../../mocks/chrome-guardhero';
import { useState, useEffect, useCallback } from 'react';
import { RuleBuilder, HeaderRule } from './RuleBuilder';
import { downloadJson } from '../storage-manager/StorageExporter';

const STORAGE_KEY = 'guardhero-header-rules';

function loadRules(): HeaderRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HeaderRule[];
  } catch {
    return [];
  }
}

function saveRules(rules: HeaderRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  // Push to native header_modifier
  // In production: window.chrome?.guardhero?.setHeaderRules?.(rules)
}

const css = `
  .he-root { display: flex; height: 100%; background: var(--bg, #0A0E1A); color: var(--text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
  .he-list-panel { width: 280px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; }
  .he-toolbar { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .he-title { font-weight: 700; font-size: 14px; flex: 1; }
  .he-add-btn { padding: 4px 10px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 5px; color: var(--accent, #00D4FF); cursor: pointer; font-size: 12px; }
  .he-action-btn { padding: 4px 8px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .he-action-btn:hover { color: #fff; }
  .he-rule-list { flex: 1; overflow-y: auto; padding: 6px 0; }
  .he-rule-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
  .he-rule-item:hover { background: rgba(255,255,255,0.03); }
  .he-rule-item.selected { background: rgba(0,212,255,0.06); }
  .he-rule-item.disabled { opacity: 0.4; }
  .he-rule-toggle { width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
  .he-rule-info { flex: 1; min-width: 0; }
  .he-rule-name { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .he-rule-meta { font-size: 10px; color: #8892A4; margin-top: 2px; }
  .he-rule-del { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 13px; padding: 0 3px; flex-shrink: 0; }
  .he-rule-del:hover { color: #FF4B6E; }
  .he-op-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-right: 4px; }
  .he-op-add    { background: rgba(39,193,116,0.15); color: #27C174; }
  .he-op-modify { background: rgba(0,212,255,0.12); color: var(--accent, #00D4FF); }
  .he-op-remove { background: rgba(255,75,110,0.12); color: #FF4B6E; }
  .he-detail-panel { flex: 1; overflow: hidden; }
  .he-empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #8892A4; flex-direction: column; gap: 8px; }
  .he-empty-hint { font-size: 12px; }

  /* RuleBuilder */
  .rb2-root { display: flex; flex-direction: column; height: 100%; }
  .rb2-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .rb2-title { flex: 1; font-weight: 700; font-size: 14px; }
  .rb2-enabled-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #8892A4; cursor: pointer; }
  .rb2-close { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 16px; }
  .rb2-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  .rb2-field { display: flex; flex-direction: column; gap: 6px; }
  .rb2-label { font-size: 11px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; }
  .rb2-input { padding: 7px 10px; background: #0D1120; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
  .rb2-input:focus { border-color: rgba(0,212,255,0.4); }
  .rb2-pattern-row { display: flex; gap: 6px; }
  .rb2-test-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .rb2-test-input { flex: 1; padding: 5px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #fff; font-size: 12px; outline: none; }
  .rb2-test-btn { padding: 5px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .rb2-match { font-size: 12px; font-weight: 500; }
  .rb2-match-yes { color: #27C174; }
  .rb2-match-no { color: #FF4B6E; }
  .rb2-radio-group { display: flex; gap: 16px; }
  .rb2-radio { display: flex; align-items: center; gap: 5px; font-size: 13px; color: #ccc; cursor: pointer; }
  .rb2-hint { font-size: 11px; color: #8892A4; }
  .rb2-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .rb2-cancel-btn { padding: 7px 14px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #8892A4; cursor: pointer; font-size: 13px; }
  .rb2-save-btn { padding: 7px 18px; background: var(--accent, #00D4FF); color: #0A0E1A; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
  .rb2-save-btn:disabled { opacity: 0.5; }
`;

function operationBadge(op: HeaderRule['operation']) {
  return (
    <span className={`he-op-badge he-op-${op}`}>
      {op.toUpperCase()}
    </span>
  );
}

export default function HeaderEditor() {
  const [rules, setRules] = useState<HeaderRule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setRules(loadRules());
  }, []);

  const selectedRule = rules.find((r) => r.id === selectedId) ?? null;

  const handleAdd = () => {
    setSelectedId(null);
    setIsCreating(true);
  };

  const handleRuleChange = useCallback(
    (rule: HeaderRule) => {
      setRules((prev) => {
        const exists = prev.some((r) => r.id === rule.id);
        const updated = exists
          ? prev.map((r) => (r.id === rule.id ? rule : r))
          : [...prev, rule];
        saveRules(updated);
        return updated;
      });
      setSelectedId(rule.id);
      setIsCreating(false);
    },
    []
  );

  const handleToggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRules((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      );
      saveRules(updated);
      return updated;
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRules((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveRules(updated);
      return updated;
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleExport = () => {
    downloadJson(rules, 'guardhero-header-rules.json');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as HeaderRule[];
        setRules(imported);
        saveRules(imported);
      } catch {
        console.error('Guard Hero: failed to import header rules');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const showBuilder = isCreating || selectedRule !== null;

  return (
    <>
      <style>{css}</style>
      <div className="he-root">
        {/* Rule list panel */}
        <div className="he-list-panel">
          <div className="he-toolbar">
            <span className="he-title">Header Rules</span>
            <button className="he-add-btn" onClick={handleAdd}>
              + Add
            </button>
            <button className="he-action-btn" onClick={handleExport}>↑</button>
            <label className="he-action-btn">
              ↓
              <input type="file" accept=".json" onChange={handleImport} hidden />
            </label>
          </div>

          <div className="he-rule-list">
            {rules.length === 0 && (
              <div style={{ padding: '20px 12px', color: '#8892A4', fontSize: 12 }}>
                No rules yet. Click + Add to create one.
              </div>
            )}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`he-rule-item${selectedId === rule.id ? ' selected' : ''}${!rule.enabled ? ' disabled' : ''}`}
                onClick={() => {
                  setSelectedId(rule.id);
                  setIsCreating(false);
                }}
              >
                <input
                  type="checkbox"
                  className="he-rule-toggle"
                  checked={rule.enabled}
                  onChange={() => {}}
                  onClick={(e) => handleToggle(rule.id, e)}
                />
                <div className="he-rule-info">
                  <div className="he-rule-name">
                    {operationBadge(rule.operation)}
                    {rule.headerName || '(unnamed)'}
                  </div>
                  <div className="he-rule-meta">
                    {rule.urlPattern} · {rule.headerType} · {rule.scope}
                  </div>
                </div>
                <button
                  className="he-rule-del"
                  onClick={(e) => handleDelete(rule.id, e)}
                  title="Delete rule"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Detail / builder panel */}
        <div className="he-detail-panel">
          {showBuilder ? (
            <RuleBuilder
              rule={isCreating ? null : selectedRule}
              onChange={handleRuleChange}
              onClose={() => {
                setIsCreating(false);
                setSelectedId(null);
              }}
            />
          ) : (
            <div className="he-empty-state">
              <span style={{ fontSize: 32 }}>⚙</span>
              <span className="he-empty-hint">
                Select a rule to edit, or click + Add
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
