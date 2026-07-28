// Copyright (c) 2025 Guard Hero. All rights reserved.
// useRequestStream.ts — Subscribes to chrome.guardhero.onRequestEvent and
// accumulates events in React state.

import { useState, useEffect, useCallback, useRef } from 'react';
import { RequestEvent } from '../../mocks/chrome-guardhero';

export type RequestFilter = 'all' | 'blocked' | 'allowed' | 'modified';

export interface UseRequestStreamResult {
  events: RequestEvent[];
  filter: RequestFilter;
  setFilter: (f: RequestFilter) => void;
  clearEvents: () => void;
  filteredEvents: RequestEvent[];
}

const MAX_EVENTS = 500;

export function useRequestStream(): UseRequestStreamResult {
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const bufferRef = useRef<RequestEvent[]>([]);

  useEffect(() => {
    const api = window.chrome?.guardhero;
    if (!api) {
      return;
    }

    const handleEvent = (event: RequestEvent) => {
      bufferRef.current = [event, ...bufferRef.current].slice(0, MAX_EVENTS);
      setEvents([...bufferRef.current]);
    };

    api.onRequestEvent.addListener(handleEvent);
    return () => {
      api.onRequestEvent.removeListener(handleEvent);
    };
  }, []);

  const clearEvents = useCallback(() => {
    bufferRef.current = [];
    setEvents([]);
  }, []);

  const filteredEvents =
    filter === 'all'
      ? events
      : events.filter(
          (e) => e.decision.toLowerCase() === filter
        );

  return { events, filter, setFilter, clearEvents, filteredEvents };
}
