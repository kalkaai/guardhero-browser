// Type declarations for chrome.guardhero — the Guard Hero native bridge API.
// In production this is injected by the native messaging host.
// In development it is mocked by mocks/chrome-guardhero.ts.

interface GuardHeroAPI {
  getSessionStats(): Promise<{
    blocked: number;
    modified: number;
    allowed: number;
    cname_blocked: number;
    top_blocked_domains: string[];
  }>;
  getPageStats(tabId: number): Promise<{
    tab_id: number;
    blocked: number;
    blocked_trackers: string[];
  }>;
  getAllTimeStats(): Promise<{
    total_blocked: number;
    sessions: number;
    first_install_date: string;
  }>;
  setBlockingEnabled(enabled: boolean): Promise<void>;
  allowDomain(domain: string): Promise<void>;
  blockDomain(domain: string): Promise<void>;
  isBlockingEnabled(): Promise<boolean>;
  onRequestEvent: {
    addListener(fn: (event: {
      url: string;
      type: string;
      decision: 'BLOCKED' | 'ALLOWED' | 'MODIFIED';
      reason: string;
      stripped_params: string[];
      cname_chain: string[];
      tab_id: number;
      timestamp: number;
    }) => void): void;
    removeListener(fn: (event: {
      url: string;
      type: string;
      decision: 'BLOCKED' | 'ALLOWED' | 'MODIFIED';
      reason: string;
      stripped_params: string[];
      cname_chain: string[];
      tab_id: number;
      timestamp: number;
    }) => void): void;
  };
}

declare namespace chrome {
  // eslint-disable-next-line no-var
  var guardhero: GuardHeroAPI | undefined;
}
