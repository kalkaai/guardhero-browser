// Copyright (c) 2025 Guard Hero. All rights reserved.
// LocalStorageView.tsx — Key-value table for localStorage / sessionStorage.

import { useState, useEffect, useCallback } from 'react';
import { downloadJson } from './StorageExporter';

interface Props {
  storageType: 'localStorage' | 'sessionStorage';
}

interface KVEntry {
  key: string;
  value: string;
  editing: boolean;
  editValue: string;
}

function getStorage(type: Props['storageType']): Storage {
  return type === 'localStorage' ? localStorage : sessionStorage;
}

function readAll(type: Props['storageType']): KVEntry[] {
  const storage = getStorage(type);
  const entries: KVEntry[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) {
      entries.push({
        key,
        value: storage.getItem(key) ?? '',
        editing: false,
        editValue: '',
      });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function LocalStorageView({ storageType }: Props) {
  const [entries, setEntries] = useState<KVEntry[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const refresh = useCallback(() => {
    setEntries(readAll(storageType));
  }, [storageType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEdit = (key: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key ? { ...e, editing: true, editValue: e.value } : e
      )
    );
  };

  const handleSave = (key: string, newVal: string) => {
    getStorage(storageType).setItem(key, newVal);
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key
          ? { ...e, editing: false, value: newVal, editValue: '' }
          : e
      )
    );
  };

  const handleCancel = (key: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.key === key ? { ...e, editing: false, editValue: '' } : e
      )
    );
  };

  const handleDelete = (key: string) => {
    getStorage(storageType).removeItem(key);
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    getStorage(storageType).setItem(newKey.trim(), newValue);
    refresh();
    setNewKey('');
    setNewValue('');
  };

  const handleExport = () => {
    const data: Record<string, string> = {};
    entries.forEach((e) => { data[e.key] = e.value; });
    downloadJson(data, `${storageType}-${location.hostname}.json`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, string>;
        const storage = getStorage(storageType);
        for (const [k, v] of Object.entries(data)) {
          storage.setItem(k, String(v));
        }
        refresh();
      } catch {
        console.error('Guard Hero: failed to import storage JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="lsv-root">
      <div className="lsv-toolbar">
        <span className="lsv-count">{entries.length} items</span>
        <button className="lsv-action-btn" onClick={handleExport}>
          Export JSON
        </button>
        <label className="lsv-action-btn">
          Import JSON
          <input type="file" accept=".json" onChange={handleImport} hidden />
        </label>
        <button className="lsv-action-btn" onClick={refresh}>
          Refresh
        </button>
      </div>

      <div className="lsv-table-wrap">
        <table className="lsv-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.key} onDoubleClick={() => handleEdit(e.key)}>
                <td className="lsv-key">{e.key}</td>
                <td className="lsv-val">
                  {e.editing ? (
                    <input
                      className="lsv-edit-input"
                      value={e.editValue}
                      autoFocus
                      onChange={(ev) =>
                        setEntries((prev) =>
                          prev.map((x) =>
                            x.key === e.key
                              ? { ...x, editValue: ev.target.value }
                              : x
                          )
                        )
                      }
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') handleSave(e.key, e.editValue);
                        if (ev.key === 'Escape') handleCancel(e.key);
                      }}
                    />
                  ) : (
                    <span className="lsv-val-text">{e.value}</span>
                  )}
                </td>
                <td className="lsv-actions">
                  {e.editing ? (
                    <>
                      <button
                        className="lsv-save-btn"
                        onClick={() => handleSave(e.key, e.editValue)}
                      >
                        ✓
                      </button>
                      <button
                        className="lsv-cancel-btn"
                        onClick={() => handleCancel(e.key)}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      className="lsv-del-btn"
                      onClick={() => handleDelete(e.key)}
                      title="Delete"
                    >
                      🗑
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new key */}
      <div className="lsv-add-row">
        <input
          className="lsv-add-key"
          placeholder="New key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="lsv-add-val"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="lsv-add-btn" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
}
