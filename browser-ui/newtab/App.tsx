// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// App.tsx — Guard Hero New Tab Page root component.

import '../mocks/chrome-guardhero';  // Inject mock in dev; no-op in prod
import { Clock }      from './components/Clock';
import { SearchBar }  from './components/SearchBar';
import { StatsPanel } from './components/StatsPanel';
import { TopSites }   from './components/TopSites';
import { QuickLinks } from './components/QuickLinks';
import './styles/newtab.css';

// Shield logo SVG
function ShieldLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
         aria-hidden="true">
      <path d="M12 2L4 6v6c0 5.25 3.5 9.75 8 11 4.5-1.25 8-5.75 8-11V6L12 2z"
            fill="var(--accent)" />
      <path d="M9 12l2 2 4-4" stroke="#0A0E1A" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  return (
    <main className="ntp-root">
      {/* Header: logo + clock */}
      <header className="ntp-header">
        <div className="ntp-logo">
          <div className="ntp-logo-icon">
            <ShieldLogo />
          </div>
          <span className="ntp-logo-text">Guard Hero</span>
        </div>
        <Clock />
      </header>

      {/* Search bar */}
      <SearchBar />

      {/* Blocking stats */}
      <StatsPanel />

      {/* Top sites */}
      <TopSites />

      {/* Quick links */}
      <QuickLinks />
    </main>
  );
}
