// Copyright (c) 2025 Guard Hero. All rights reserved.
// Scratchpad.tsx — Main JS scratchpad container.
// Split pane: MonacoPane (left), OutputPane (right).
// Execution context: Page (in page's main world) vs Isolated.

import { useState, useCallback, useId } from 'react';
import { MonacoPane } from './MonacoPane';
import { OutputPane, OutputEntry } from './OutputPane';
import { SnippetManager } from './SnippetManager';

type ExecutionContext = 'page' | 'isolated';

const STORAGE_KEY = 'guardhero-scratchpad-code';

function loadCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '// Write JavaScript here\n// Ctrl+Enter to run\n\npage.cookies()';
  } catch {
    return '// Write JavaScript here\n// Ctrl+Enter to run\n';
  }
}

// Run JS in the scratchpad's own isolated context (mock — real impl uses
// chrome.devtools.inspectedWindow.eval for page context).
async function evalCode(
  code: string,
  _context: ExecutionContext
): Promise<{ result: unknown; isError: boolean; errorMessage?: string; stackTrace?: string }> {
  // In production with page context, calls:
  //   chrome.devtools.inspectedWindow.eval(code, { useContentScriptContext: false })
  //
  // In isolated context (or mock), eval in our own JS context.
  try {
    // Wrap in async IIFE to support top-level await
    const wrapped = `(async function() { return (${code}); })()`;
    // eslint-disable-next-line no-eval
    const result = await eval(wrapped);
    return { result, isError: false };
  } catch (err) {
    return {
      result: undefined,
      isError: true,
      errorMessage: err instanceof Error ? err.message : String(err),
      stackTrace: err instanceof Error ? err.stack : undefined,
    };
  }
}

const css = `
  .sp-root { display: flex; flex-direction: column; height: 100%; background: var(--bg, #0A0E1A); color: var(--text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
  .sp-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .sp-title { font-weight: 700; font-size: 14px; flex: 1; }
  .sp-run-btn { padding: 5px 14px; background: var(--accent, #00D4FF); color: #0A0E1A; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px; }
  .sp-run-btn:disabled { opacity: 0.5; }
  .sp-ctx-select { padding: 4px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #8892A4; font-size: 12px; cursor: pointer; }
  .sp-snippet-btn { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .sp-snippet-btn:hover { color: #fff; }
  .sp-body { flex: 1; display: flex; overflow: hidden; gap: 1px; }
  .sp-left { flex: 1; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid rgba(255,255,255,0.08); }
  .sp-right { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  /* MonacoPane */
  .monaco-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .monaco-hint { padding: 4px 12px; font-size: 10px; color: #8892A4; border-bottom: 1px solid rgba(255,255,255,0.04); flex-shrink: 0; }
  .monaco-textarea { flex: 1; width: 100%; resize: none; background: #0D1120; border: none; outline: none; color: #E2E8F0; font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.7; padding: 12px 16px; }

  /* OutputPane */
  .op-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .op-toolbar { display: flex; align-items: center; padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .op-label { font-size: 11px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; flex: 1; }
  .op-clear-btn { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 11px; }
  .op-clear-btn:hover { color: #fff; }
  .op-content { flex: 1; overflow-y: auto; padding: 8px; }
  .op-empty { display: flex; align-items: center; justify-content: center; height: 100px; color: #8892A4; font-size: 12px; }
  .op-entry { background: rgba(255,255,255,0.02); border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; border-left: 3px solid rgba(0,212,255,0.3); }
  .op-entry-error { border-left-color: rgba(255,75,110,0.6); background: rgba(255,75,110,0.04); }
  .op-entry-header { display: flex; gap: 8px; margin-bottom: 6px; }
  .op-ts { font-size: 10px; color: #8892A4; flex-shrink: 0; }
  .op-expr { font-size: 11px; color: #8892A4; font-family: 'SF Mono', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .op-entry-result { font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; }
  .op-null, .op-undefined { color: #8892A4; }
  .op-bool { color: #FFB800; }
  .op-num { color: #27C174; }
  .op-str { color: #FFA07A; }
  .op-obj { color: #E2E8F0; margin: 0; white-space: pre-wrap; font-size: 12px; }
  .op-line { display: block; }
  .op-error { }
  .op-error-msg { color: #FF4B6E; font-weight: 500; font-size: 12px; }
  .op-stack { font-family: 'SF Mono', monospace; font-size: 11px; color: rgba(255,75,110,0.7); white-space: pre-wrap; margin-top: 4px; }

  /* SnippetManager */
  .sm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
  .sm-modal { background: #111827; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; width: 560px; max-width: 95vw; max-height: 80vh; display: flex; flex-direction: column; }
  .sm-header { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .sm-title { flex: 1; font-weight: 700; font-size: 15px; }
  .sm-close { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 16px; }
  .sm-tabs { display: flex; gap: 2px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .sm-tab { padding: 5px 14px; border-radius: 6px; border: none; background: transparent; color: #8892A4; cursor: pointer; font-size: 13px; }
  .sm-tab.active { background: rgba(255,255,255,0.06); color: #fff; }
  .sm-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .sm-empty { color: #8892A4; text-align: center; padding: 24px; font-size: 13px; }
  .sm-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; }
  .sm-item:hover { background: rgba(255,255,255,0.06); }
  .sm-item-info { flex: 1 }
  .sm-item-name { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .sm-item-desc { font-size: 11px; color: #8892A4; }
  .sm-item-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .sm-load-btn { padding: 4px 12px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 5px; color: var(--accent, #00D4FF); cursor: pointer; font-size: 12px; }
  .sm-del-btn { background: none; border: none; color: #FF4B6E; cursor: pointer; font-size: 14px; padding: 0 4px; }
  .sm-save-form { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); }
  .sm-input { padding: 7px 10px; background: #0D1120; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
  .sm-save-btn { padding: 7px 16px; background: var(--accent, #00D4FF); color: #0A0E1A; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
  .sm-save-btn:disabled { opacity: 0.5; }
`;

export default function Scratchpad() {
  const [code, setCode] = useState(loadCode);
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState<ExecutionContext>('isolated');
  const [showSnippets, setShowSnippets] = useState(false);
  const idPrefix = useId();

  const handleRun = useCallback(async () => {
    if (!code.trim() || running) return;
    setRunning(true);

    const entry: OutputEntry = {
      id: `${idPrefix}-${Date.now()}`,
      timestamp: Date.now(),
      expression: code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'))[0] ?? code.slice(0, 60),
      result: undefined,
      isError: false,
    };

    const outcome = await evalCode(code, context);

    entry.result = outcome.result;
    entry.isError = outcome.isError;
    entry.errorMessage = outcome.errorMessage;
    entry.stackTrace = outcome.stackTrace;

    setEntries((prev) => [entry, ...prev]);
    setRunning(false);
  }, [code, context, running, idPrefix]);

  return (
    <>
      <style>{css}</style>
      <div className="sp-root">
        <div className="sp-toolbar">
          <span className="sp-title">JS Scratchpad</span>
          <select
            className="sp-ctx-select"
            value={context}
            onChange={(e) => setContext(e.target.value as ExecutionContext)}
            title="Execution context"
          >
            <option value="isolated">Isolated context</option>
            <option value="page">Page context</option>
          </select>
          <button
            className="sp-snippet-btn"
            onClick={() => setShowSnippets(true)}
          >
            Snippets
          </button>
          <button
            className="sp-run-btn"
            onClick={handleRun}
            disabled={running || !code.trim()}
            title="Run (Ctrl+Enter)"
          >
            ▶ Run
          </button>
        </div>

        <div className="sp-body">
          <div className="sp-left">
            <MonacoPane code={code} onChange={setCode} onRun={handleRun} />
          </div>
          <div className="sp-right">
            <OutputPane entries={entries} onClear={() => setEntries([])} />
          </div>
        </div>
      </div>

      <SnippetManager
        currentCode={code}
        onLoadSnippet={setCode}
        isOpen={showSnippets}
        onClose={() => setShowSnippets(false)}
      />
    </>
  );
}
