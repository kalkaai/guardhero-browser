// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// SearchBar.tsx — Submits to the browser's address bar via window.location.

import { useState, useRef, FormEvent } from 'react';

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({ placeholder = 'Search or enter address' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Detect if input is a URL or a search query
    const isUrl = /^(https?:\/\/|ftp:\/\/|file:\/\/|guardhero:\/\/)/.test(trimmed)
      || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(trimmed);

    if (isUrl) {
      const href = trimmed.startsWith('http') || trimmed.startsWith('guardhero://')
        ? trimmed
        : `https://${trimmed}`;
      window.location.href = href;
    } else {
      // Submit to DuckDuckGo (the default search engine)
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
      window.location.href = searchUrl;
    }
  }

  return (
    <div className="ntp-search-container">
      <form className="ntp-search-form" onSubmit={handleSubmit} role="search">
        <span className="ntp-search-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          className="ntp-search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search or enter web address"
          autoComplete="off"
          autoFocus
        />
      </form>
    </div>
  );
}
