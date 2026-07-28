// Copyright (c) 2025 Guard Hero. All rights reserved.
// StorageExporter.ts — Export / import all browser storage types as JSON.

export interface StorageSnapshot {
  exportedAt: string;
  url: string;
  cookies: CookieEntry[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB: Record<string, unknown>;
}

export interface CookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

// ── Export helpers ────────────────────────────────────────────────────────────

export function exportLocalStorage(): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) {
      result[key] = localStorage.getItem(key) ?? '';
    }
  }
  return result;
}

export function exportSessionStorage(): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key !== null) {
      result[key] = sessionStorage.getItem(key) ?? '';
    }
  }
  return result;
}

export async function exportIndexedDB(): Promise<Record<string, unknown>> {
  // Enumerate all IDB databases and export their object stores.
  const databases = await indexedDB.databases();
  const result: Record<string, unknown> = {};

  for (const dbInfo of databases) {
    if (!dbInfo.name) continue;

    try {
      const dbData = await exportSingleIDB(dbInfo.name, dbInfo.version ?? 1);
      result[dbInfo.name] = dbData;
    } catch {
      result[dbInfo.name] = { error: 'Failed to export' };
    }
  }

  return result;
}

async function exportSingleIDB(
  name: string,
  version: number
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onsuccess = () => {
      const db = req.result;
      const result: Record<string, unknown> = {};
      const storeNames = Array.from(db.objectStoreNames);

      if (storeNames.length === 0) {
        db.close();
        resolve(result);
        return;
      }

      const tx = db.transaction(storeNames, 'readonly');
      let remaining = storeNames.length;

      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          result[storeName] = getAll.result;
          remaining--;
          if (remaining === 0) {
            db.close();
            resolve(result);
          }
        };
        getAll.onerror = () => {
          remaining--;
          if (remaining === 0) {
            db.close();
            resolve(result);
          }
        };
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export function parseCookies(): CookieEntry[] {
  if (!document.cookie) return [];
  return document.cookie.split(';').map((pair) => {
    const idx = pair.indexOf('=');
    const name = idx >= 0 ? pair.slice(0, idx).trim() : pair.trim();
    const value = idx >= 0 ? pair.slice(idx + 1).trim() : '';
    return {
      name,
      value: decodeURIComponent(value),
      domain: location.hostname,
      path: '/',
      expires: null,
      secure: location.protocol === 'https:',
      httpOnly: false,
      sameSite: 'Lax',
    };
  });
}

export async function exportAll(): Promise<StorageSnapshot> {
  const [idb] = await Promise.all([exportIndexedDB()]);
  return {
    exportedAt: new Date().toISOString(),
    url: location.href,
    cookies: parseCookies(),
    localStorage: exportLocalStorage(),
    sessionStorage: exportSessionStorage(),
    indexedDB: idb,
  };
}

// ── Import helpers ────────────────────────────────────────────────────────────

export function importLocalStorage(data: Record<string, string>): void {
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, value);
  }
}

export function importSessionStorage(data: Record<string, string>): void {
  for (const [key, value] of Object.entries(data)) {
    sessionStorage.setItem(key, value);
  }
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
