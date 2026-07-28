// Copyright (c) 2025 Guard Hero. All rights reserved.
// RequestBuilder.tsx — HTTP method selector, URL input, tabbed editor.

import { useState, useCallback } from 'react';
import { RequestConfig } from './useRequestSender';
import { EnvVariable, resolveVariables } from './EnvironmentManager';

type RequestTab = 'headers' | 'body' | 'auth' | 'params';
type BodyType = 'json' | 'form' | 'raw' | 'binary';
type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

interface Props {
  onSend: (config: RequestConfig) => void;
  loading: boolean;
  activeVariables: EnvVariable[];
}

function methodColor(method: string): string {
  const map: Record<string, string> = {
    GET: '#27C174',
    POST: '#FFB800',
    PUT: '#00D4FF',
    PATCH: '#B57BFF',
    DELETE: '#FF4B6E',
    HEAD: '#27C174',
    OPTIONS: '#8892A4',
  };
  return map[method] ?? '#8892A4';
}

export function RequestBuilder({ onSend, loading, activeVariables }: Props) {
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState<RequestTab>('headers');
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ]);
  const [params, setParams] = useState<KeyValuePair[]>([
    { key: '', value: '', enabled: true },
  ]);
  const [bodyType, setBodyType] = useState<BodyType>('json');
  const [bodyText, setBodyText] = useState('{\n  \n}');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authValue, setAuthValue] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');

  const resolve = useCallback(
    (text: string) => resolveVariables(text, activeVariables),
    [activeVariables]
  );

  const buildQueryString = useCallback(() => {
    const pairs = params
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(resolve(p.value))}`)
      .join('&');
    return pairs ? `?${pairs}` : '';
  }, [params, resolve]);

  const handleSend = useCallback(() => {
    const resolvedUrl = resolve(url) + buildQueryString();

    const headerMap: Record<string, string> = {};
    headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        headerMap[h.key] = resolve(h.value);
      });

    // Inject auth header
    if (authType === 'bearer' && authValue) {
      headerMap['Authorization'] = `Bearer ${resolve(authValue)}`;
    } else if (authType === 'basic' && basicUser) {
      headerMap['Authorization'] =
        'Basic ' + btoa(`${basicUser}:${basicPass}`);
    } else if (authType === 'apikey' && apiKeyName && authValue) {
      headerMap[apiKeyName] = resolve(authValue);
    }

    const config: RequestConfig = {
      method,
      url: resolvedUrl,
      headers: headerMap,
      body: ['POST', 'PUT', 'PATCH'].includes(method)
        ? bodyText
        : undefined,
    };

    onSend(config);
  }, [
    method, url, headers, params, bodyText, authType, authValue,
    basicUser, basicPass, apiKeyName, resolve, buildQueryString, onSend,
  ]);

  const updatePair = (
    list: KeyValuePair[],
    setList: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    idx: number,
    field: keyof KeyValuePair,
    value: string | boolean
  ) => {
    const updated = [...list];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-add empty row when the last row gets a key
    if (field === 'key' && idx === list.length - 1 && value) {
      updated.push({ key: '', value: '', enabled: true });
    }
    setList(updated);
  };

  const removePair = (
    list: KeyValuePair[],
    setList: React.Dispatch<React.SetStateAction<KeyValuePair[]>>,
    idx: number
  ) => {
    setList(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="rb-root">
      {/* Method + URL + Send */}
      <div className="rb-url-row">
        <select
          className="rb-method-select"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          style={{ color: methodColor(method) }}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} style={{ color: methodColor(m) }}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="rb-url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
        />
        <button
          className="rb-send-btn"
          onClick={handleSend}
          disabled={loading || !url.trim()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="rb-tabs">
        {(['headers', 'body', 'auth', 'params'] as RequestTab[]).map((tab) => (
          <button
            key={tab}
            className={`rb-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'headers' && headers.filter((h) => h.enabled && h.key).length > 0 && (
              <span className="tab-badge">
                {headers.filter((h) => h.enabled && h.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rb-tab-content">
        {/* Headers */}
        {activeTab === 'headers' && (
          <div className="kv-editor">
            {headers.map((h, i) => (
              <div key={i} className="kv-row">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) =>
                    updatePair(headers, setHeaders, i, 'enabled', e.target.checked)
                  }
                />
                <input
                  className="kv-key"
                  value={h.key}
                  onChange={(e) =>
                    updatePair(headers, setHeaders, i, 'key', e.target.value)
                  }
                  placeholder="Header name"
                  list="common-headers"
                />
                <input
                  className="kv-val"
                  value={h.value}
                  onChange={(e) =>
                    updatePair(headers, setHeaders, i, 'value', e.target.value)
                  }
                  placeholder="Value (supports {{vars}})"
                />
                <button
                  className="kv-remove"
                  onClick={() => removePair(headers, setHeaders, i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="kv-add"
              onClick={() =>
                setHeaders((h) => [...h, { key: '', value: '', enabled: true }])
              }
            >
              + Add header
            </button>
            <datalist id="common-headers">
              {['Authorization', 'Content-Type', 'Accept', 'Accept-Language',
                'Cache-Control', 'User-Agent', 'Origin', 'Referer',
                'X-Requested-With', 'X-API-Key'].map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          </div>
        )}

        {/* Body */}
        {activeTab === 'body' && (
          <div className="body-editor">
            <div className="body-type-row">
              {(['json', 'form', 'raw', 'binary'] as BodyType[]).map((t) => (
                <label key={t} className="body-type-opt">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={bodyType === t}
                    onChange={() => setBodyType(t)}
                  />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
            <textarea
              className="body-textarea"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={
                bodyType === 'json'
                  ? '{ "key": "value" }'
                  : bodyType === 'form'
                  ? 'key=value&key2=value2'
                  : 'Raw body'
              }
              spellCheck={false}
            />
          </div>
        )}

        {/* Auth */}
        {activeTab === 'auth' && (
          <div className="auth-editor">
            <div className="auth-type-row">
              {(['none', 'bearer', 'basic', 'apikey'] as AuthType[]).map(
                (t) => (
                  <label key={t} className="auth-type-opt">
                    <input
                      type="radio"
                      name="authType"
                      checked={authType === t}
                      onChange={() => setAuthType(t)}
                    />
                    {t === 'bearer'
                      ? 'Bearer'
                      : t === 'basic'
                      ? 'Basic'
                      : t === 'apikey'
                      ? 'API Key'
                      : 'None'}
                  </label>
                )
              )}
            </div>
            {authType === 'bearer' && (
              <div className="auth-field">
                <label>Token</label>
                <input
                  className="auth-input"
                  value={authValue}
                  onChange={(e) => setAuthValue(e.target.value)}
                  placeholder="Bearer token (supports {{vars}})"
                />
              </div>
            )}
            {authType === 'basic' && (
              <>
                <div className="auth-field">
                  <label>Username</label>
                  <input
                    className="auth-input"
                    value={basicUser}
                    onChange={(e) => setBasicUser(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label>Password</label>
                  <input
                    className="auth-input"
                    type="password"
                    value={basicPass}
                    onChange={(e) => setBasicPass(e.target.value)}
                  />
                </div>
              </>
            )}
            {authType === 'apikey' && (
              <>
                <div className="auth-field">
                  <label>Header name</label>
                  <input
                    className="auth-input"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                  />
                </div>
                <div className="auth-field">
                  <label>Key value</label>
                  <input
                    className="auth-input"
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                    placeholder="Supports {{vars}}"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Params */}
        {activeTab === 'params' && (
          <div className="kv-editor">
            {params.map((p, i) => (
              <div key={i} className="kv-row">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) =>
                    updatePair(params, setParams, i, 'enabled', e.target.checked)
                  }
                />
                <input
                  className="kv-key"
                  value={p.key}
                  onChange={(e) =>
                    updatePair(params, setParams, i, 'key', e.target.value)
                  }
                  placeholder="Parameter name"
                />
                <input
                  className="kv-val"
                  value={p.value}
                  onChange={(e) =>
                    updatePair(params, setParams, i, 'value', e.target.value)
                  }
                  placeholder="Value"
                />
                <button
                  className="kv-remove"
                  onClick={() => removePair(params, setParams, i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
