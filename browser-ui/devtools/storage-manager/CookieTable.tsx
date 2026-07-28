// Copyright (c) 2025 Guard Hero. All rights reserved.
// CookieTable.tsx — Table of all cookies for the current domain.
// EagleEye integration: cookies from tracker domains show a red 🛡 badge.

import { useState, useEffect, useCallback } from 'react';
import { parseCookies, CookieEntry } from './StorageExporter';

// Known tracker domains (subset — full list from EagleEye blocklist in production).
const TRACKER_DOMAINS = new Set([
  'google-analytics.com',
  'doubleclick.net',
  'facebook.com',
  'facebook.net',
  'hotjar.com',
  'criteo.com',
  'adsystem.com',
  'scorecardresearch.com',
  'quantserve.com',
  'mc.yandex.ru',
  'hubspot.com',
  'marketo.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
]);

function isTrackerDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  for (const tracker of TRACKER_DOMAINS) {
    if (d === tracker || d.endsWith('.' + tracker)) return true;
  }
  return false;
}

interface EditableEntry extends CookieEntry {
  editing: boolean;
  editValue: string;
}

export function CookieTable() {
  const [cookies, setCookies] = useState<EditableEntry[]>([]);

  const refresh = useCallback(() => {
    const raw = parseCookies();
    setCookies(
      raw.map((c) => ({ ...c, editing: false, editValue: '' }))
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const trackerCookies = cookies.filter((c) => isTrackerDomain(c.domain));

  const handleDeleteAll = () => {
    for (const c of trackerCookies) {
      // Expire the cookie by setting a past date.
      document.cookie = `${c.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${c.path}; domain=${c.domain}`;
    }
    refresh();
  };

  const handleDelete = (cookie: EditableEntry) => {
    document.cookie = `${cookie.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${cookie.path}`;
    refresh();
  };

  const handleEdit = (name: string) => {
    setCookies((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, editing: true, editValue: c.value } : c
      )
    );
  };

  const handleSave = (cookie: EditableEntry) => {
    document.cookie = `${cookie.name}=${encodeURIComponent(cookie.editValue)}; path=${cookie.path}`;
    setCookies((prev) =>
      prev.map((c) =>
        c.name === cookie.name
          ? { ...c, editing: false, value: cookie.editValue, editValue: '' }
          : c
      )
    );
  };

  const handleCancel = (name: string) => {
    setCookies((prev) =>
      prev.map((c) =>
        c.name === name ? { ...c, editing: false, editValue: '' } : c
      )
    );
  };

  return (
    <div className="ct-root">
      <div className="ct-toolbar">
        <span className="ct-count">{cookies.length} cookies</span>
        {trackerCookies.length > 0 && (
          <button className="ct-delete-trackers-btn" onClick={handleDeleteAll}>
            🛡 Delete {trackerCookies.length} tracker cookie
            {trackerCookies.length > 1 ? 's' : ''}
          </button>
        )}
        <button className="ct-refresh-btn" onClick={refresh}>
          Refresh
        </button>
      </div>

      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th>Domain</th>
              <th>Path</th>
              <th>Expires</th>
              <th>S</th>
              <th>H</th>
              <th>SS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cookies.map((c) => {
              const tracker = isTrackerDomain(c.domain);
              return (
                <tr
                  key={c.name}
                  className={tracker ? 'ct-row tracker-row' : 'ct-row'}
                  onDoubleClick={() => handleEdit(c.name)}
                >
                  <td className="ct-name">
                    {tracker && (
                      <span className="tracker-badge" title="Tracker domain">
                        🛡
                      </span>
                    )}
                    {c.name}
                  </td>
                  <td className="ct-val">
                    {c.editing ? (
                      <input
                        className="ct-edit-input"
                        value={c.editValue}
                        autoFocus
                        onChange={(e) =>
                          setCookies((prev) =>
                            prev.map((x) =>
                              x.name === c.name
                                ? { ...x, editValue: e.target.value }
                                : x
                            )
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(c);
                          if (e.key === 'Escape') handleCancel(c.name);
                        }}
                      />
                    ) : (
                      <span className="ct-val-text" title={c.value}>
                        {c.value.length > 40
                          ? c.value.slice(0, 40) + '…'
                          : c.value}
                      </span>
                    )}
                  </td>
                  <td className="ct-domain">{c.domain}</td>
                  <td className="ct-path">{c.path}</td>
                  <td className="ct-expires dim">
                    {c.expires ?? 'Session'}
                  </td>
                  <td className="ct-flag">{c.secure ? '✓' : ''}</td>
                  <td className="ct-flag">{c.httpOnly ? '✓' : ''}</td>
                  <td className="ct-flag dim">{c.sameSite}</td>
                  <td className="ct-actions">
                    {c.editing ? (
                      <>
                        <button
                          className="ct-save-btn"
                          onClick={() => handleSave(c)}
                        >
                          ✓
                        </button>
                        <button
                          className="ct-cancel-btn"
                          onClick={() => handleCancel(c.name)}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        className="ct-del-btn"
                        onClick={() => handleDelete(c)}
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
