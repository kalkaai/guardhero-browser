// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// chrome-guardhero.ts — Mock implementation of chrome.guardhero.* APIs
// for development and testing. Replace with real bridge in production.

export interface SessionStats {
  blocked: number;
  modified: number;
  allowed: number;
  cname_blocked: number;
  top_blocked_domains: string[];
}

export interface PageStats {
  tab_id: number;
  blocked: number;
  blocked_trackers: string[];
}

export interface AllTimeStats {
  total_blocked: number;
  sessions: number;
  first_install_date: string;
}

export interface RequestEvent {
  url: string;
  type: string;
  decision: 'BLOCKED' | 'ALLOWED' | 'MODIFIED';
  reason: string;
  stripped_params: string[];
  cname_chain: string[];
  tab_id: number;
  timestamp: number;
}

// Mock data — realistic numbers for development UI work
const mockSessionStats: SessionStats = {
  blocked: 42,
  modified: 8,
  allowed: 312,
  cname_blocked: 2,
  top_blocked_domains: [
    'google-analytics.com',
    'doubleclick.net',
    'facebook.net',
    'hotjar.com',
    'criteo.com',
  ],
};

const mockPageStats: PageStats = {
  tab_id: 1,
  blocked: 12,
  blocked_trackers: [
    'analytics.google.com',
    'facebook.net/tr',
    'doubleclick.net',
    'hotjar.com',
    'mc.yandex.ru',
  ],
};

const mockAllTimeStats: AllTimeStats = {
  total_blocked: 18420,
  sessions: 47,
  first_install_date: '2025-01-15',
};

// Simulated event listeners
type RequestEventListener = (event: RequestEvent) => void;
const requestEventListeners: RequestEventListener[] = [];

// Generate mock request events at random intervals
function startMockEventStream() {
  const trackers = [
    { url: 'https://google-analytics.com/collect', type: 'XHR', decision: 'BLOCKED' as const },
    { url: 'https://facebook.net/tr/', type: 'Pixel', decision: 'BLOCKED' as const },
    { url: 'https://cdn.example.com/app.js', type: 'Script', decision: 'ALLOWED' as const },
    { url: 'https://api.myapp.com/data', type: 'Fetch', decision: 'ALLOWED' as const },
    { url: 'https://doubleclick.net/pixel', type: 'Image', decision: 'BLOCKED' as const },
  ];

  setInterval(() => {
    const event = trackers[Math.floor(Math.random() * trackers.length)];
    const mockEvent: RequestEvent = {
      ...event,
      reason: event.decision === 'BLOCKED' ? 'EagleEye blocklist' : '',
      stripped_params: [],
      cname_chain: [],
      tab_id: 1,
      timestamp: Date.now(),
    };
    requestEventListeners.forEach(fn => fn(mockEvent));
  }, 2000);
}

// Auto-start event stream in mock mode
if (typeof window !== 'undefined') {
  startMockEventStream();
}

// ── Mock chrome.guardhero API ────────────────────────────────────────────────

export const mockGuardHeroAPI = {
  getSessionStats: (): Promise<SessionStats> =>
    Promise.resolve({ ...mockSessionStats }),

  getPageStats: (tabId: number): Promise<PageStats> =>
    Promise.resolve({ ...mockPageStats, tab_id: tabId }),

  getAllTimeStats: (): Promise<AllTimeStats> =>
    Promise.resolve({ ...mockAllTimeStats }),

  setBlockingEnabled: (enabled: boolean): Promise<void> => {
    console.log(`[GuardHero Mock] Blocking ${enabled ? 'enabled' : 'disabled'}`);
    return Promise.resolve();
  },

  allowDomain: (domain: string): Promise<void> => {
    console.log(`[GuardHero Mock] Allowed domain: ${domain}`);
    return Promise.resolve();
  },

  blockDomain: (domain: string): Promise<void> => {
    console.log(`[GuardHero Mock] Blocked domain: ${domain}`);
    return Promise.resolve();
  },

  isBlockingEnabled: (): Promise<boolean> => Promise.resolve(true),

  onRequestEvent: {
    addListener: (fn: RequestEventListener) => {
      requestEventListeners.push(fn);
    },
    removeListener: (fn: RequestEventListener) => {
      const idx = requestEventListeners.indexOf(fn);
      if (idx >= 0) requestEventListeners.splice(idx, 1);
    },
  },
};

// ── Inject into window.chrome.guardhero if not already present ─────────────

if (typeof window !== 'undefined' && !chrome.guardhero) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (!win.chrome) win.chrome = {};
  win.chrome.guardhero = mockGuardHeroAPI;

  // Mock chrome.topSites.get
  win.chrome.topSites = {
    get: (cb: (data: { title: string; url: string }[]) => void) => {
      cb([
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'Hacker News', url: 'https://news.ycombinator.com' },
        { title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
        { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
        { title: 'YouTube', url: 'https://youtube.com' },
        { title: 'Figma', url: 'https://figma.com' },
        { title: 'Linear', url: 'https://linear.app' },
        { title: 'Notion', url: 'https://notion.so' },
      ]);
    },
  };
}

export default mockGuardHeroAPI;
