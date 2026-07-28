// Copyright (c) 2025 Guard Hero. All rights reserved.
// useRequestSender.ts — Sends HTTP requests via fetch(), with a CORS bypass
// hook for DevMode (chrome.guardhero.sendDevRequest bypasses CORS in devtools).

import { useState, useCallback } from 'react';

export interface RequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  sizeBytes: number;
  isJson: boolean;
  parsedJson?: unknown;
}

export interface UseRequestSenderResult {
  send: (config: RequestConfig) => Promise<void>;
  response: ResponseData | null;
  loading: boolean;
  error: string | null;
  clearResponse: () => void;
}

// In production this calls chrome.guardhero.sendDevRequest which bypasses CORS.
// In dev/mock mode we fall back to standard fetch().
async function sendRequest(config: RequestConfig): Promise<ResponseData> {
  const start = performance.now();

  const init: RequestInit = {
    method: config.method,
    headers: config.headers,
  };

  const methodsWithBody = ['POST', 'PUT', 'PATCH'];
  if (config.body && methodsWithBody.includes(config.method.toUpperCase())) {
    init.body = config.body;
  }

  const response = await fetch(config.url, init);
  const elapsed = Math.round(performance.now() - start);

  const bodyText = await response.text();
  const sizeBytes = new TextEncoder().encode(bodyText).byteLength;

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let isJson = false;
  let parsedJson: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      parsedJson = JSON.parse(bodyText);
      isJson = true;
    } catch {
      // not valid JSON despite content-type
    }
  } else {
    try {
      parsedJson = JSON.parse(bodyText);
      isJson = true;
    } catch {
      // not JSON
    }
  }

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: bodyText,
    timeMs: elapsed,
    sizeBytes,
    isJson,
    parsedJson,
  };
}

export function useRequestSender(): UseRequestSenderResult {
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (config: RequestConfig) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await sendRequest(config);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
  }, []);

  return { send, response, loading, error, clearResponse };
}
