// Copyright (c) 2025 Guard Hero. All rights reserved.
// ApiTester.tsx — Main container for the built-in REST client.

import '../../mocks/chrome-guardhero';
import { useState, useCallback } from 'react';
import { RequestBuilder } from './RequestBuilder';
import { ResponseViewer } from './ResponseViewer';
import { CollectionManager } from './CollectionManager';
import { EnvironmentManager, EnvVariable } from './EnvironmentManager';
import { useRequestSender, RequestConfig } from './useRequestSender';
import { SavedRequest } from './CollectionManager';

const css = `
  .at-root { display: flex; height: 100%; background: var(--bg, #0A0E1A); color: var(--text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; overflow: hidden; }
  .at-sidebar { width: 220px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; overflow: hidden; }
  .at-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .at-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
  .at-title { font-weight: 700; font-size: 14px; flex: 1; }
  .at-env-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #8892A4; cursor: pointer; font-size: 12px; }
  .at-env-btn:hover { color: #fff; }
  .at-request-area { flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .at-response-area { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
  .at-env-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center; }
  .at-env-modal { background: #111827; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; width: 700px; max-width: 95vw; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }

  /* RequestBuilder styles */
  .rb-root { padding: 12px 16px; }
  .rb-url-row { display: flex; gap: 8px; margin-bottom: 8px; }
  .rb-method-select { padding: 6px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; min-width: 90px; }
  .rb-url-input { flex: 1; padding: 6px 12px; background: #0D1120; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; font-size: 13px; outline: none; }
  .rb-url-input:focus { border-color: rgba(0,212,255,0.4); }
  .rb-send-btn { padding: 6px 18px; background: var(--accent, #00D4FF); color: #0A0E1A; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
  .rb-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .rb-tabs { display: flex; gap: 2px; margin-bottom: 8px; }
  .rb-tab { padding: 4px 12px; border-radius: 5px; border: none; background: transparent; color: #8892A4; cursor: pointer; font-size: 12px; position: relative; }
  .rb-tab.active { background: rgba(255,255,255,0.06); color: #fff; }
  .tab-badge { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background: rgba(0,212,255,0.2); color: var(--accent, #00D4FF); border-radius: 8px; font-size: 10px; margin-left: 4px; }
  .rb-tab-content { min-height: 100px; max-height: 200px; overflow-y: auto; }
  .kv-editor { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
  .kv-row { display: flex; align-items: center; gap: 6px; }
  .kv-key, .kv-val { flex: 1; padding: 4px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #fff; font-size: 12px; outline: none; }
  .kv-key:focus, .kv-val:focus { border-color: rgba(0,212,255,0.3); }
  .kv-remove { background: none; border: none; color: #FF4B6E; cursor: pointer; font-size: 14px; padding: 0 4px; }
  .kv-add { background: none; border: none; color: var(--accent, #00D4FF); cursor: pointer; font-size: 12px; padding: 4px 0; text-align: left; }
  .body-editor { display: flex; flex-direction: column; gap: 8px; }
  .body-type-row { display: flex; gap: 12px; }
  .body-type-opt { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #8892A4; cursor: pointer; }
  .body-textarea { width: 100%; min-height: 120px; padding: 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #E2E8F0; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; resize: vertical; outline: none; }
  .body-textarea:focus { border-color: rgba(0,212,255,0.3); }
  .auth-editor { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
  .auth-type-row { display: flex; gap: 16px; }
  .auth-type-opt { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #8892A4; cursor: pointer; }
  .auth-field { display: flex; flex-direction: column; gap: 4px; }
  .auth-field label { font-size: 11px; color: #8892A4; }
  .auth-input { padding: 6px 10px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; font-size: 12px; outline: none; width: 100%; }

  /* ResponseViewer styles */
  .rv-root { flex: 1; display: flex; flex-direction: column; padding: 12px 16px; overflow: hidden; }
  .rv-loading, .rv-error, .rv-empty { display: flex; align-items: center; justify-content: center; gap: 12px; flex: 1; color: #8892A4; }
  .rv-spinner { width: 20px; height: 20px; border: 2px solid rgba(0,212,255,0.2); border-top-color: var(--accent, #00D4FF); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rv-error-icon { font-size: 24px; color: #FF4B6E; }
  .rv-error-msg { color: #FF4B6E; }
  .rv-placeholder { color: #8892A4; font-size: 13px; }
  .rv-blocked-warning { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,75,110,0.1); border: 1px solid rgba(255,75,110,0.3); border-radius: 6px; color: #FF4B6E; font-size: 12px; margin-bottom: 12px; }
  .rv-warning-icon { font-size: 16px; }
  .rv-status-bar { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .rv-status-code { font-weight: 700; font-size: 14px; }
  .rv-stat { font-size: 12px; color: #8892A4; }
  .rv-tabs { display: flex; gap: 2px; margin-bottom: 8px; }
  .rv-tab { padding: 4px 12px; border-radius: 5px; border: none; background: transparent; color: #8892A4; cursor: pointer; font-size: 12px; }
  .rv-tab.active { background: rgba(255,255,255,0.06); color: #fff; }
  .rv-content { flex: 1; overflow-y: auto; min-height: 0; }
  .rv-json-tree { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.7; }
  .json-toggle { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 10px; padding: 0 2px; }
  .rv-raw-text { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #E2E8F0; }
  .rv-headers-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .rv-headers-table th { text-align: left; padding: 6px 10px; color: #8892A4; font-weight: 600; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .rv-headers-table td { padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .header-name { color: var(--accent, #00D4FF); }
  .header-value { color: #E2E8F0; word-break: break-all; }

  /* CollectionManager styles */
  .cm-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .cm-header { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .cm-title { flex: 1; font-weight: 600; font-size: 12px; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; }
  .cm-actions { display: flex; gap: 4px; }
  .cm-action-btn { padding: 3px 8px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .cm-body { flex: 1; overflow-y: auto; padding: 8px; }
  .cm-empty { color: #8892A4; font-size: 12px; text-align: center; padding: 20px; }
  .cm-tree { list-style: none; padding: 0; margin: 0; }
  .cm-node { margin-bottom: 2px; }
  .cm-node-header { display: flex; align-items: center; gap: 4px; padding: 6px 8px; cursor: pointer; border-radius: 6px; }
  .cm-node-header:hover { background: rgba(255,255,255,0.04); }
  .cm-chevron { font-size: 10px; color: #8892A4; width: 12px; }
  .cm-node-name { flex: 1; font-size: 12px; font-weight: 600; }
  .cm-node-save, .cm-node-delete { background: none; border: none; cursor: pointer; font-size: 12px; color: #8892A4; padding: 0 4px; }
  .cm-node-save:hover { color: var(--accent, #00D4FF); }
  .cm-node-delete:hover { color: #FF4B6E; }
  .cm-subtree { list-style: none; padding: 0 0 0 20px; margin: 0; }
  .cm-request { display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer; border-radius: 5px; }
  .cm-request:hover { background: rgba(255,255,255,0.04); }
  .cm-req-name { font-size: 12px; color: #E2E8F0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cm-folder-header { display: flex; align-items: center; gap: 4px; padding: 5px 8px; cursor: pointer; }
  .cm-folder-name { font-size: 12px; color: #8892A4; }
  .cm-new-coll { display: flex; gap: 4px; padding: 8px; border-top: 1px solid rgba(255,255,255,0.06); }
  .cm-new-input { flex: 1; padding: 5px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #fff; font-size: 12px; outline: none; }
  .cm-new-btn { padding: 5px 10px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 5px; color: var(--accent, #00D4FF); cursor: pointer; font-size: 14px; }
  .method-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.06); flex-shrink: 0; }
  .method-get    { color: #27C174; }
  .method-post   { color: #FFB800; }
  .method-put    { color: #00D4FF; }
  .method-patch  { color: #B57BFF; }
  .method-delete { color: #FF4B6E; }
  .method-head, .method-options { color: #8892A4; }

  /* EnvironmentManager styles */
  .env-manager { display: flex; flex-direction: column; height: 100%; }
  .env-header { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .env-title { flex: 1; font-weight: 700; font-size: 15px; }
  .em-close-btn { background: none; border: none; color: #8892A4; cursor: pointer; font-size: 16px; }
  .env-body { display: flex; flex: 1; overflow: hidden; }
  .env-sidebar { width: 160px; border-right: 1px solid rgba(255,255,255,0.08); padding: 12px 0; overflow-y: auto; }
  .env-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 16px; background: none; border: none; color: #8892A4; cursor: pointer; font-size: 13px; text-align: left; position: relative; }
  .env-item.active { color: #fff; background: rgba(255,255,255,0.04); }
  .env-item.is-active-env { color: var(--accent, #00D4FF); }
  .env-active-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent, #00D4FF); }
  .env-detail { flex: 1; padding: 16px; overflow-y: auto; }
  .var-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  .var-table th { text-align: left; padding: 4px 6px; color: #8892A4; font-size: 11px; }
  .var-input { width: 100%; padding: 4px 6px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #fff; font-size: 12px; outline: none; }
  .var-remove { background: none; border: none; color: #FF4B6E; cursor: pointer; }
  .add-var-btn { background: none; border: none; color: var(--accent, #00D4FF); cursor: pointer; font-size: 12px; }
`;

export default function ApiTester() {
  const { send, response, loading, error } = useRequestSender();
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [activeEnvId, setActiveEnvId] = useState('dev');
  const [activeVariables, setActiveVariables] = useState<EnvVariable[]>([]);
  const [currentRequest, setCurrentRequest] = useState<
    RequestConfig & { name?: string }
  >({ method: 'GET', url: '', headers: {} });

  const handleSend = useCallback(
    (config: RequestConfig) => {
      setCurrentRequest(config);
      send(config);
    },
    [send]
  );

  const handleLoadRequest = useCallback((req: SavedRequest) => {
    setCurrentRequest({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      name: req.name,
    });
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="at-root" style={{ position: 'relative' }}>
        {/* Sidebar */}
        <div className="at-sidebar">
          <CollectionManager
            onLoadRequest={handleLoadRequest}
            currentRequest={currentRequest}
          />
        </div>

        {/* Main */}
        <div className="at-main">
          <div className="at-toolbar">
            <span className="at-title">API Tester</span>
            <button
              className="at-env-btn"
              onClick={() => setShowEnvManager(true)}
            >
              Env: {activeEnvId}
            </button>
          </div>

          <div className="at-request-area">
            <RequestBuilder
              onSend={handleSend}
              loading={loading}
              activeVariables={activeVariables}
            />
          </div>

          <div className="at-response-area">
            <ResponseViewer
              response={response}
              loading={loading}
              error={error}
            />
          </div>
        </div>

        {/* Environment manager overlay */}
        {showEnvManager && (
          <div className="at-env-overlay">
            <div className="at-env-modal">
              <EnvironmentManager
                activeEnvId={activeEnvId}
                onActiveEnvChange={setActiveEnvId}
                onVariablesChange={setActiveVariables}
                onClose={() => setShowEnvManager(false)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
