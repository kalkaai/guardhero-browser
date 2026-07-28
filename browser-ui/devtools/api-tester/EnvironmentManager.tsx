// Copyright (c) 2025 Guard Hero. All rights reserved.
// EnvironmentManager.tsx — Named environments with key-value variable pairs.
// Active environment variables substitute {{var}} tokens in URLs and headers.
// Stored in IndexedDB.

import { useState, useEffect, useCallback } from 'react';

export interface EnvVariable {
  key: string;
  value: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
}

// IndexedDB helpers (lightweight, no external library required)
const DB_NAME = 'guardhero-api-tester';
const DB_VERSION = 1;
const STORE_ENV = 'environments';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ENV)) {
        db.createObjectStore(STORE_ENV, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadEnvs(): Promise<Environment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENV, 'readonly');
    const req = tx.objectStore(STORE_ENV).getAll();
    req.onsuccess = () => resolve(req.result as Environment[]);
    req.onerror = () => reject(req.error);
  });
}

async function saveEnv(env: Environment): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENV, 'readwrite');
    tx.objectStore(STORE_ENV).put(env);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Substitutes {{varName}} tokens with values from activeEnv.
export function resolveVariables(
  text: string,
  variables: EnvVariable[]
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = variables.find((v) => v.key === name);
    return v ? v.value : `{{${name}}}`;
  });
}

const DEFAULT_ENVS: Environment[] = [
  {
    id: 'dev',
    name: 'Dev',
    variables: [
      { key: 'base_url', value: 'http://localhost:3000' },
      { key: 'auth_token', value: '' },
    ],
  },
  {
    id: 'staging',
    name: 'Staging',
    variables: [
      { key: 'base_url', value: 'https://staging.api.example.com' },
      { key: 'auth_token', value: '' },
    ],
  },
  {
    id: 'prod',
    name: 'Prod',
    variables: [
      { key: 'base_url', value: 'https://api.example.com' },
      { key: 'auth_token', value: '' },
    ],
  },
];

interface Props {
  activeEnvId: string;
  onActiveEnvChange: (envId: string) => void;
  onVariablesChange: (variables: EnvVariable[]) => void;
  onClose: () => void;
}

export function EnvironmentManager({
  activeEnvId,
  onActiveEnvChange,
  onVariablesChange,
  onClose,
}: Props) {
  const [environments, setEnvironments] = useState<Environment[]>(DEFAULT_ENVS);
  const [selectedId, setSelectedId] = useState<string>(activeEnvId);
  useEffect(() => {
    loadEnvs().then((envs) => {
      if (envs.length > 0) {
        setEnvironments(envs);
      }
    });
  }, []);

  const selectedEnv = environments.find((e) => e.id === selectedId);

  const handleSelectEnv = (id: string) => {
    setSelectedId(id);
    const env = environments.find((e) => e.id === id);
    if (env) {
      onActiveEnvChange(id);
      onVariablesChange(env.variables);
    }
  };

  const handleSaveVar = useCallback(
    async (envId: string, idx: number, field: 'key' | 'value', val: string) => {
      setEnvironments((prev) => {
        const updated = prev.map((e) => {
          if (e.id !== envId) return e;
          const newVars = [...e.variables];
          newVars[idx] = { ...newVars[idx], [field]: val };
          return { ...e, variables: newVars };
        });
        const env = updated.find((e) => e.id === envId);
        if (env) saveEnv(env);
        if (envId === activeEnvId && env) {
          onVariablesChange(env.variables);
        }
        return updated;
      });
    },
    [activeEnvId, onVariablesChange]
  );

  const handleAddVar = (envId: string) => {
    setEnvironments((prev) => {
      const updated = prev.map((e) =>
        e.id === envId
          ? { ...e, variables: [...e.variables, { key: '', value: '' }] }
          : e
      );
      const env = updated.find((e) => e.id === envId);
      if (env) saveEnv(env);
      return updated;
    });
  };

  const handleRemoveVar = (envId: string, idx: number) => {
    setEnvironments((prev) => {
      const updated = prev.map((e) =>
        e.id === envId
          ? { ...e, variables: e.variables.filter((_, i) => i !== idx) }
          : e
      );
      const env = updated.find((e) => e.id === envId);
      if (env) saveEnv(env);
      return updated;
    });
  };

  return (
    <div className="env-manager">
      <div className="env-header">
        <span className="env-title">Environments</span>
        <button className="em-close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="env-body">
        <div className="env-sidebar">
          {environments.map((env) => (
            <button
              key={env.id}
              className={`env-item${selectedId === env.id ? ' active' : ''}${activeEnvId === env.id ? ' is-active-env' : ''}`}
              onClick={() => handleSelectEnv(env.id)}
            >
              {env.name}
              {activeEnvId === env.id && (
                <span className="env-active-dot" title="Active" />
              )}
            </button>
          ))}
        </div>
        <div className="env-detail">
          {selectedEnv && (
            <>
              <table className="var-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Value</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {selectedEnv.variables.map((v, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          className="var-input"
                          value={v.key}
                          onChange={(e) =>
                            handleSaveVar(selectedEnv.id, i, 'key', e.target.value)
                          }
                          placeholder="variable_name"
                        />
                      </td>
                      <td>
                        <input
                          className="var-input"
                          value={v.value}
                          onChange={(e) =>
                            handleSaveVar(
                              selectedEnv.id,
                              i,
                              'value',
                              e.target.value
                            )
                          }
                          placeholder="value"
                        />
                      </td>
                      <td>
                        <button
                          className="var-remove"
                          onClick={() => handleRemoveVar(selectedEnv.id, i)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="add-var-btn"
                onClick={() => handleAddVar(selectedEnv.id)}
              >
                + Add variable
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
