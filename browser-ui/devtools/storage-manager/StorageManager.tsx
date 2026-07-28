// Copyright (c) 2025 Guard Hero. All rights reserved.
// StorageManager.tsx — Main container for the Cookie & Storage Manager.

import { useState } from 'react';
import { CookieTable } from './CookieTable';
import { LocalStorageView } from './LocalStorageView';
import { exportAll, downloadJson } from './StorageExporter';

type StorageNode =
  | 'cookies'
  | 'localStorage'
  | 'sessionStorage'
  | 'indexedDB'
  | 'cacheStorage';

const TREE_NODES: { id: StorageNode; label: string; icon: string }[] = [
  { id: 'cookies',       label: 'Cookies',         icon: '🍪' },
  { id: 'localStorage',  label: 'Local Storage',   icon: '💾' },
  { id: 'sessionStorage',label: 'Session Storage', icon: '⏱' },
  { id: 'indexedDB',     label: 'IndexedDB',       icon: '🗃' },
  { id: 'cacheStorage',  label: 'Cache Storage',   icon: '📦' },
];

const css = `
  .sm-root { display: flex; height: 100%; background: var(--bg, #0A0E1A); color: var(--text, #fff); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
  .sm-sidebar { width: 200px; flex-shrink: 0; border-right: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; padding: 8px 0; }
  .sm-sidebar-title { padding: 8px 14px; font-size: 10px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.05em; }
  .sm-tree-node { display: flex; align-items: center; gap: 8px; padding: 8px 14px; cursor: pointer; color: #8892A4; font-size: 13px; border-radius: 0; }
  .sm-tree-node:hover { color: #fff; background: rgba(255,255,255,0.03); }
  .sm-tree-node.active { color: var(--accent, #00D4FF); background: rgba(0,212,255,0.06); }
  .sm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .sm-main-header { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; gap: 8px; }
  .sm-main-title { font-weight: 700; font-size: 14px; flex: 1; }
  .sm-export-all-btn { padding: 4px 12px; background: transparent; border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .sm-export-all-btn:hover { color: #fff; }
  .sm-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .sm-placeholder { display: flex; align-items: center; justify-content: center; flex: 1; color: #8892A4; font-size: 13px; }

  /* CookieTable */
  .ct-root { display: flex; flex-direction: column; height: 100%; }
  .ct-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .ct-count { flex: 1; font-size: 12px; color: #8892A4; }
  .ct-delete-trackers-btn { padding: 4px 10px; background: rgba(255,75,110,0.1); border: 1px solid rgba(255,75,110,0.3); border-radius: 5px; color: #FF4B6E; cursor: pointer; font-size: 12px; }
  .ct-refresh-btn { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .ct-table-wrap { flex: 1; overflow: auto; }
  .ct-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .ct-table thead th { padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; background: #0D1120; z-index: 1; }
  .ct-row { border-bottom: 1px solid rgba(255,255,255,0.04); cursor: default; }
  .ct-row:hover { background: rgba(255,255,255,0.02); }
  .tracker-row { background: rgba(255,75,110,0.04); }
  .tracker-row:hover { background: rgba(255,75,110,0.07); }
  .ct-table td { padding: 6px 10px; vertical-align: middle; }
  .ct-name { display: flex; align-items: center; gap: 4px; font-family: monospace; font-size: 12px; }
  .tracker-badge { font-size: 12px; }
  .ct-val { max-width: 160px; }
  .ct-val-text { color: #E2E8F0; }
  .ct-edit-input { width: 100%; padding: 3px 6px; background: #0A0E1A; border: 1px solid rgba(0,212,255,0.3); border-radius: 4px; color: #fff; font-size: 12px; outline: none; }
  .ct-domain, .ct-path { color: #8892A4; font-size: 11px; }
  .ct-expires { font-size: 11px; }
  .ct-flag { font-size: 11px; color: #27C174; text-align: center; }
  .dim { color: #8892A4; }
  .ct-actions { display: flex; gap: 4px; }
  .ct-del-btn, .ct-save-btn, .ct-cancel-btn { background: none; border: none; cursor: pointer; font-size: 13px; padding: 0 3px; }
  .ct-del-btn { color: #FF4B6E; }
  .ct-save-btn { color: #27C174; }
  .ct-cancel-btn { color: #8892A4; }

  /* LocalStorageView */
  .lsv-root { display: flex; flex-direction: column; height: 100%; }
  .lsv-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .lsv-count { flex: 1; font-size: 12px; color: #8892A4; }
  .lsv-action-btn { padding: 4px 10px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #8892A4; cursor: pointer; font-size: 12px; }
  .lsv-action-btn:hover { color: #fff; }
  .lsv-table-wrap { flex: 1; overflow: auto; }
  .lsv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .lsv-table thead th { padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; background: #0D1120; }
  .lsv-table tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
  .lsv-table tr:hover { background: rgba(255,255,255,0.02); }
  .lsv-table td { padding: 6px 10px; }
  .lsv-key { font-family: monospace; font-size: 12px; color: var(--accent, #00D4FF); }
  .lsv-val { max-width: 300px; }
  .lsv-val-text { color: #E2E8F0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; max-width: 300px; }
  .lsv-edit-input { width: 100%; padding: 3px 6px; background: #0A0E1A; border: 1px solid rgba(0,212,255,0.3); border-radius: 4px; color: #fff; font-size: 12px; outline: none; }
  .lsv-actions { display: flex; gap: 4px; }
  .lsv-del-btn, .lsv-save-btn, .lsv-cancel-btn { background: none; border: none; cursor: pointer; font-size: 13px; padding: 0 3px; }
  .lsv-del-btn { color: #FF4B6E; }
  .lsv-save-btn { color: #27C174; }
  .lsv-cancel-btn { color: #8892A4; }
  .lsv-add-row { display: flex; gap: 6px; padding: 8px 14px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
  .lsv-add-key, .lsv-add-val { flex: 1; padding: 5px 8px; background: #0D1120; border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; color: #fff; font-size: 12px; outline: none; }
  .lsv-add-btn { padding: 5px 12px; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 5px; color: var(--accent, #00D4FF); cursor: pointer; font-size: 12px; }
`;

function IDBPlaceholder() {
  return (
    <div className="sm-placeholder">
      IndexedDB viewer — select a page to inspect its databases
    </div>
  );
}

function CacheStoragePlaceholder() {
  return (
    <div className="sm-placeholder">
      Cache Storage viewer — available when a service worker is active
    </div>
  );
}

export default function StorageManager() {
  const [activeNode, setActiveNode] = useState<StorageNode>('cookies');

  const handleExportAll = async () => {
    const snapshot = await exportAll();
    downloadJson(snapshot, `guardhero-storage-export-${Date.now()}.json`);
  };

  const activeLabel =
    TREE_NODES.find((n) => n.id === activeNode)?.label ?? '';

  return (
    <>
      <style>{css}</style>
      <div className="sm-root">
        <div className="sm-sidebar">
          <div className="sm-sidebar-title">Storage</div>
          {TREE_NODES.map((node) => (
            <div
              key={node.id}
              className={`sm-tree-node${activeNode === node.id ? ' active' : ''}`}
              onClick={() => setActiveNode(node.id)}
            >
              <span>{node.icon}</span>
              {node.label}
            </div>
          ))}
        </div>

        <div className="sm-main">
          <div className="sm-main-header">
            <span className="sm-main-title">{activeLabel}</span>
            <button className="sm-export-all-btn" onClick={handleExportAll}>
              Export all
            </button>
          </div>

          <div className="sm-content">
            {activeNode === 'cookies' && <CookieTable />}
            {activeNode === 'localStorage' && (
              <LocalStorageView storageType="localStorage" />
            )}
            {activeNode === 'sessionStorage' && (
              <LocalStorageView storageType="sessionStorage" />
            )}
            {activeNode === 'indexedDB' && <IDBPlaceholder />}
            {activeNode === 'cacheStorage' && <CacheStoragePlaceholder />}
          </div>
        </div>
      </div>
    </>
  );
}
