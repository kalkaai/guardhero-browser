// Copyright (c) 2025 Guard Hero. All rights reserved.
// CollectionManager.tsx — Sidebar with saved request collections.
// Tree view: Collection → Folder → Request
// Import/export as JSON (Postman-compatible format). Stored in IndexedDB.

import { useState, useEffect } from 'react';
import { RequestConfig } from './useRequestSender';

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: SavedRequest[];
}

export interface Collection {
  id: string;
  name: string;
  folders: CollectionFolder[];
  requests: SavedRequest[]; // top-level requests not in a folder
}

// Postman-compatible export envelope
interface PostmanExport {
  info: { name: string; schema: string };
  item: PostmanItem[];
}

interface PostmanItem {
  name: string;
  request?: { method: string; url: string; header: { key: string; value: string }[]; body?: { raw: string } };
  item?: PostmanItem[];
}

const DB_NAME = 'guardhero-api-tester';
const DB_VERSION = 1;
const STORE_COLL = 'collections';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_COLL)) {
        db.createObjectStore(STORE_COLL, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadCollections(): Promise<Collection[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLL, 'readonly');
    const req = tx.objectStore(STORE_COLL).getAll();
    req.onsuccess = () => resolve(req.result as Collection[]);
    req.onerror = () => reject(req.error);
  });
}

async function saveCollection(col: Collection): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLL, 'readwrite');
    tx.objectStore(STORE_COLL).put(col);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteCollection(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_COLL, 'readwrite');
    tx.objectStore(STORE_COLL).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function newId(): string {
  return Math.random().toString(36).slice(2);
}

function exportToPostman(collections: Collection[]): string {
  const items: PostmanItem[] = collections.flatMap((col) => {
    const topRequests: PostmanItem[] = col.requests.map((r) => ({
      name: r.name,
      request: {
        method: r.method,
        url: r.url,
        header: Object.entries(r.headers).map(([k, v]) => ({ key: k, value: v })),
        body: r.body ? { raw: r.body } : undefined,
      },
    }));
    const folders: PostmanItem[] = col.folders.map((f) => ({
      name: f.name,
      item: f.requests.map((r) => ({
        name: r.name,
        request: {
          method: r.method,
          url: r.url,
          header: Object.entries(r.headers).map(([k, v]) => ({
            key: k,
            value: v,
          })),
          body: r.body ? { raw: r.body } : undefined,
        },
      })),
    }));
    return [
      {
        name: col.name,
        item: [...folders, ...topRequests],
      },
    ];
  });

  const envelope: PostmanExport = {
    info: {
      name: 'Guard Hero API Tester Export',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };
  return JSON.stringify(envelope, null, 2);
}

interface Props {
  onLoadRequest: (req: SavedRequest) => void;
  currentRequest?: RequestConfig & { name?: string };
}

export function CollectionManager({ onLoadRequest, currentRequest }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newCollName, setNewCollName] = useState('');
  const [, setSaving] = useState(false);

  useEffect(() => {
    loadCollections().then((cols) => {
      if (cols.length > 0) setCollections(cols);
    });
  }, []);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNewCollection = async () => {
    if (!newCollName.trim()) return;
    const col: Collection = {
      id: newId(),
      name: newCollName.trim(),
      folders: [],
      requests: [],
    };
    await saveCollection(col);
    setCollections((prev) => [...prev, col]);
    setNewCollName('');
  };

  const handleSaveRequest = async (colId: string) => {
    if (!currentRequest) return;
    setSaving(true);
    const req: SavedRequest = {
      id: newId(),
      name: currentRequest.name || `${currentRequest.method} ${currentRequest.url}`,
      method: currentRequest.method,
      url: currentRequest.url,
      headers: currentRequest.headers,
      body: currentRequest.body,
    };
    setCollections((prev) => {
      const updated = prev.map((c) =>
        c.id === colId ? { ...c, requests: [...c.requests, req] } : c
      );
      const col = updated.find((c) => c.id === colId);
      if (col) saveCollection(col);
      return updated;
    });
    setSaving(false);
  };

  const handleDeleteCollection = async (id: string) => {
    await deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleExport = () => {
    const json = exportToPostman(collections);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guardhero-collections.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string) as PostmanExport;
        const imported: Collection[] = (data.item ?? []).map((item) => ({
          id: newId(),
          name: item.name,
          folders: (item.item ?? [])
            .filter((i) => i.item)
            .map((folder) => ({
              id: newId(),
              name: folder.name,
              requests: (folder.item ?? []).map((r) => ({
                id: newId(),
                name: r.name,
                method: r.request?.method ?? 'GET',
                url:
                  typeof r.request?.url === 'string'
                    ? r.request.url
                    : '',
                headers: Object.fromEntries(
                  (r.request?.header ?? []).map((h) => [h.key, h.value])
                ),
                body: r.request?.body?.raw,
              })),
            })),
          requests: (item.item ?? [])
            .filter((i) => !i.item && i.request)
            .map((r) => ({
              id: newId(),
              name: r.name,
              method: r.request?.method ?? 'GET',
              url:
                typeof r.request?.url === 'string'
                  ? r.request.url
                  : '',
              headers: Object.fromEntries(
                (r.request?.header ?? []).map((h) => [h.key, h.value])
              ),
              body: r.request?.body?.raw,
            })),
        }));
        for (const col of imported) {
          await saveCollection(col);
        }
        setCollections((prev) => [...prev, ...imported]);
      } catch (err) {
        console.error('Guard Hero: Failed to import collections', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="cm-root">
      <div className="cm-header">
        <span className="cm-title">Collections</span>
        <div className="cm-actions">
          <button className="cm-action-btn" onClick={handleExport} title="Export">
            ↑
          </button>
          <label className="cm-action-btn" title="Import">
            ↓
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
        </div>
      </div>

      <div className="cm-body">
        {collections.length === 0 ? (
          <div className="cm-empty">No collections yet</div>
        ) : (
          <ul className="cm-tree">
            {collections.map((col) => (
              <li key={col.id} className="cm-node">
                <div
                  className="cm-node-header"
                  onClick={() => toggleExpanded(col.id)}
                >
                  <span className="cm-chevron">
                    {expandedIds.has(col.id) ? '▾' : '▸'}
                  </span>
                  <span className="cm-node-name">{col.name}</span>
                  <button
                    className="cm-node-save"
                    title="Save current request here"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRequest(col.id);
                    }}
                  >
                    +
                  </button>
                  <button
                    className="cm-node-delete"
                    title="Delete collection"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(col.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {expandedIds.has(col.id) && (
                  <ul className="cm-subtree">
                    {col.requests.map((req) => (
                      <li
                        key={req.id}
                        className="cm-request"
                        onClick={() => onLoadRequest(req)}
                      >
                        <span className={`method-badge method-${req.method.toLowerCase()}`}>
                          {req.method}
                        </span>
                        <span className="cm-req-name">{req.name}</span>
                      </li>
                    ))}
                    {col.folders.map((folder) => (
                      <li key={folder.id} className="cm-folder">
                        <div
                          className="cm-folder-header"
                          onClick={() => toggleExpanded(folder.id)}
                        >
                          <span className="cm-chevron">
                            {expandedIds.has(folder.id) ? '▾' : '▸'}
                          </span>
                          <span className="cm-folder-name">{folder.name}</span>
                        </div>
                        {expandedIds.has(folder.id) && (
                          <ul className="cm-subtree">
                            {folder.requests.map((req) => (
                              <li
                                key={req.id}
                                className="cm-request"
                                onClick={() => onLoadRequest(req)}
                              >
                                <span
                                  className={`method-badge method-${req.method.toLowerCase()}`}
                                >
                                  {req.method}
                                </span>
                                <span className="cm-req-name">{req.name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cm-new-coll">
        <input
          className="cm-new-input"
          placeholder="New collection name"
          value={newCollName}
          onChange={(e) => setNewCollName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNewCollection()}
        />
        <button className="cm-new-btn" onClick={handleNewCollection}>
          +
        </button>
      </div>
    </div>
  );
}
