// Copyright (c) 2025 Guard Hero. All rights reserved.
// OutputPane.tsx — Displays JS execution results with syntax highlighting.

export interface OutputEntry {
  id: string;
  timestamp: number;
  expression: string;
  result: unknown;
  isError: boolean;
  errorMessage?: string;
  stackTrace?: string;
}

interface Props {
  entries: OutputEntry[];
  onClear: () => void;
}

function SyntaxValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="out-null">null</span>;
  }
  if (value === undefined) {
    return <span className="out-undefined">undefined</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="out-bool">{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="out-num">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="out-str">"{value}"</span>;
  }
  // Object / array — pretty-print JSON with syntax colours
  try {
    const json = JSON.stringify(value, null, 2);
    return (
      <pre className="out-obj">
        {json.split('\n').map((line, i) => (
          <span key={i} className="out-line">
            {line}
            {'\n'}
          </span>
        ))}
      </pre>
    );
  } catch {
    return <span className="out-str">{String(value)}</span>;
  }
}

function timestampLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function OutputPane({ entries, onClear }: Props) {
  return (
    <div className="op-root">
      <div className="op-toolbar">
        <span className="op-label">Output</span>
        {entries.length > 0 && (
          <button className="op-clear-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="op-content">
        {entries.length === 0 ? (
          <div className="op-empty">
            Run code to see output here
          </div>
        ) : (
          [...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              className={`op-entry${entry.isError ? ' op-entry-error' : ''}`}
            >
              <div className="op-entry-header">
                <span className="op-ts">{timestampLabel(entry.timestamp)}</span>
                <span className="op-expr">
                  {entry.expression.length > 80
                    ? entry.expression.slice(0, 80) + '…'
                    : entry.expression}
                </span>
              </div>
              <div className="op-entry-result">
                {entry.isError ? (
                  <div className="op-error">
                    <div className="op-error-msg">{entry.errorMessage}</div>
                    {entry.stackTrace && (
                      <pre className="op-stack">{entry.stackTrace}</pre>
                    )}
                  </div>
                ) : (
                  <SyntaxValue value={entry.result} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
