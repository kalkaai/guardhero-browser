// Copyright (c) 2025 Guard Hero. All rights reserved.
// RuleBuilder.tsx — Form for creating/editing a header modification rule.

import { useState, useEffect } from 'react';

export interface HeaderRule {
  id: string;
  enabled: boolean;
  urlPattern: string;
  headerType: 'request' | 'response';
  operation: 'add' | 'modify' | 'remove';
  headerName: string;
  value: string;
  scope: 'tab' | 'all' | 'domain';
}

const COMMON_HEADERS = [
  'Authorization',
  'Accept',
  'Accept-Language',
  'Cache-Control',
  'Content-Type',
  'Content-Security-Policy',
  'Cookie',
  'Origin',
  'Referer',
  'User-Agent',
  'X-API-Key',
  'X-Forwarded-For',
  'X-Requested-With',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Strict-Transport-Security',
];

interface Props {
  rule: HeaderRule | null;
  onChange: (rule: HeaderRule) => void;
  onClose: () => void;
}

function newRule(): HeaderRule {
  return {
    id: Math.random().toString(36).slice(2),
    enabled: true,
    urlPattern: '*',
    headerType: 'request',
    operation: 'modify',
    headerName: '',
    value: '',
    scope: 'all',
  };
}

function testPattern(pattern: string, url: string): boolean {
  if (!pattern || !url) return false;
  try {
    // Regex pattern
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      const re = new RegExp(pattern.slice(1, -1), 'i');
      return re.test(url);
    }
    // Glob to regex
    const rx = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp('^' + rx + '$', 'i').test(url);
  } catch {
    return false;
  }
}

export function RuleBuilder({ rule, onChange, onClose }: Props) {
  const [form, setForm] = useState<HeaderRule>(rule ?? newRule());
  const [testUrl, setTestUrl] = useState('');
  const [patternMatch, setPatternMatch] = useState<boolean | null>(null);

  useEffect(() => {
    setForm(rule ?? newRule());
    setTestUrl('');
    setPatternMatch(null);
  }, [rule]);

  const update = <K extends keyof HeaderRule>(field: K, value: HeaderRule[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTest = () => {
    setPatternMatch(testPattern(form.urlPattern, testUrl));
  };

  const handleSave = () => {
    if (!form.headerName.trim()) return;
    onChange(form);
  };

  return (
    <div className="rb2-root">
      <div className="rb2-header">
        <span className="rb2-title">
          {rule ? 'Edit Rule' : 'New Rule'}
        </span>
        <label className="rb2-enabled-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
          />
          Enabled
        </label>
        <button className="rb2-close" onClick={onClose}>✕</button>
      </div>

      <div className="rb2-body">
        {/* URL Pattern */}
        <div className="rb2-field">
          <label className="rb2-label">URL Pattern</label>
          <div className="rb2-pattern-row">
            <input
              className="rb2-input"
              value={form.urlPattern}
              onChange={(e) => update('urlPattern', e.target.value)}
              placeholder="*.example.com/* or /regex/"
            />
          </div>
          <div className="rb2-test-row">
            <input
              className="rb2-test-input"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="Test URL"
            />
            <button className="rb2-test-btn" onClick={handleTest}>
              Test
            </button>
            {patternMatch !== null && (
              <span
                className={`rb2-match${patternMatch ? ' rb2-match-yes' : ' rb2-match-no'}`}
              >
                {patternMatch ? '✓ Match' : '✗ No match'}
              </span>
            )}
          </div>
        </div>

        {/* Header type */}
        <div className="rb2-field">
          <label className="rb2-label">Header Type</label>
          <div className="rb2-radio-group">
            {(['request', 'response'] as const).map((t) => (
              <label key={t} className="rb2-radio">
                <input
                  type="radio"
                  name="headerType"
                  checked={form.headerType === t}
                  onChange={() => update('headerType', t)}
                />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Operation */}
        <div className="rb2-field">
          <label className="rb2-label">Operation</label>
          <div className="rb2-radio-group">
            {(['add', 'modify', 'remove'] as const).map((op) => (
              <label key={op} className="rb2-radio">
                <input
                  type="radio"
                  name="operation"
                  checked={form.operation === op}
                  onChange={() => update('operation', op)}
                />
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Header name */}
        <div className="rb2-field">
          <label className="rb2-label">Header Name</label>
          <input
            className="rb2-input"
            value={form.headerName}
            onChange={(e) => update('headerName', e.target.value)}
            placeholder="Authorization"
            list="header-names"
          />
          <datalist id="header-names">
            {COMMON_HEADERS.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>

        {/* Value — hidden for "remove" */}
        {form.operation !== 'remove' && (
          <div className="rb2-field">
            <label className="rb2-label">Value</label>
            <input
              className="rb2-input"
              value={form.value}
              onChange={(e) => update('value', e.target.value)}
              placeholder="Bearer {{auth_token}}"
            />
            <div className="rb2-hint">{'Supports {{var}} environment variables'}</div>
          </div>
        )}

        {/* Scope */}
        <div className="rb2-field">
          <label className="rb2-label">Scope</label>
          <div className="rb2-radio-group">
            {([
              ['all', 'All tabs'],
              ['tab', 'Current tab'],
              ['domain', 'Specific domain'],
            ] as const).map(([val, label]) => (
              <label key={val} className="rb2-radio">
                <input
                  type="radio"
                  name="scope"
                  checked={form.scope === val}
                  onChange={() => update('scope', val)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rb2-footer">
        <button className="rb2-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="rb2-save-btn"
          onClick={handleSave}
          disabled={!form.headerName.trim()}
        >
          Save rule
        </button>
      </div>
    </div>
  );
}
