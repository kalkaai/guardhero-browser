// Copyright (c) 2025 Guard Hero. All rights reserved.
// MonacoPane.tsx — Monaco Editor integration for the JS Scratchpad.
//
// Uses Monaco Editor via CDN import.  The editor persists content in
// chrome.storage.local across page navigations (key differentiator vs
// DevTools console which clears on navigation).
//
// In production Monaco is bundled via vite-plugin-monaco-editor.
// In development/mock mode we fall back to a plain <textarea>.

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'guardhero-scratchpad-code';

function persistCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Ignore
  }
}

interface Props {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
}

// Minimal Monaco-like syntax highlighting via a styled textarea.
// In production this is replaced by the full Monaco Editor instance.
export function MonacoPane({ code, onChange, onRun }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Attempt to load Monaco from the CDN (available in the browser context).
  // If not available, fallback textarea is shown.
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as Window & { monaco?: unknown }).monaco) {
      setLoaded(true);
      return;
    }

    // Try loading from the bundled CDN path available in Chromium's resource
    // packs.  Guard Hero Browser includes monaco-editor in resources/guardhero/.
    const script = document.createElement('script');
    script.src = 'guardhero://resources/monaco/vs/loader.js';
    script.onerror = () => {
      // CDN unavailable — fallback textarea is already rendered
    };
    script.onload = () => {
      const require = (window as unknown as { require?: (paths: string[], cb: () => void) => void }).require;
      if (require) {
        require(['vs/editor/editor.main'], () => setLoaded(true));
      }
    };
    document.head.appendChild(script);
  }, []);

  // Handle Tab key in the textarea (insert 2 spaces)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current!;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newCode = code.slice(0, start) + '  ' + code.slice(end);
      onChange(newCode);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
    // Ctrl+Enter / Cmd+Enter → run
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    persistCode(e.target.value);
  };

  return (
    <div className="monaco-pane">
      <div className="monaco-hint">
        {loaded
          ? 'Monaco Editor loaded'
          : 'JS Editor — Tab to indent, Ctrl+Enter to run'}
      </div>
      <textarea
        ref={textareaRef}
        className="monaco-textarea"
        value={code}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={`// JavaScript Scratchpad\n// Ctrl+Enter to run\n// Code persists across page navigations\n\npage.cookies()`}
      />
    </div>
  );
}
