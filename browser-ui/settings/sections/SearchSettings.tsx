// Copyright (c) 2025 Guard Hero. All rights reserved.
// SearchSettings.tsx — Default search engine settings.

import { useState } from 'react';

const SEARCH_ENGINES = [
  { id: 'duckduckgo',  label: 'DuckDuckGo',  url: 'https://duckduckgo.com/?q=%s' },
  { id: 'brave',       label: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  { id: 'startpage',   label: 'Startpage',    url: 'https://www.startpage.com/search?q=%s' },
  { id: 'ecosia',      label: 'Ecosia',       url: 'https://www.ecosia.org/search?q=%s' },
  { id: 'custom',      label: 'Custom',       url: '' },
];

export function SearchSettings() {
  const [selected, setSelected] = useState('duckduckgo');
  const [customUrl, setCustomUrl] = useState('');

  return (
    <section className="settings-section" id="search">
      <h2 className="settings-section-title">Search</h2>
      <div className="settings-group">
        <h3 className="settings-group-title">Default Search Engine</h3>
        {SEARCH_ENGINES.map(engine => (
          <label key={engine.id} className="settings-radio-row">
            <input type="radio" name="search-engine" value={engine.id}
                   checked={selected === engine.id}
                   onChange={() => setSelected(engine.id)} />
            <span className="settings-row-label">{engine.label}</span>
          </label>
        ))}
        {selected === 'custom' && (
          <div className="settings-input-row" style={{ marginTop: 8 }}>
            <input className="settings-input" type="url"
                   placeholder="https://search.example.com/search?q=%s"
                   value={customUrl} onChange={e => setCustomUrl(e.target.value)} />
          </div>
        )}
      </div>
    </section>
  );
}
