// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// TopSites.tsx — Favicon grid using chrome.topSites.get().

import { useState, useEffect } from 'react';

interface TopSite {
  title: string;
  url: string;
}

function getFaviconUrl(url: string): string {
  try {
    const origin = new URL(url).origin;
    // Use Chromium's built-in favicon service (no external CDN)
    return `chrome-extension://favicon/${origin}`;
  } catch {
    return '';
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function SiteIcon({ url, title }: { url: string; title: string }) {
  const [imgError, setImgError] = useState(false);
  const letter = title.charAt(0).toUpperCase();

  if (imgError) {
    return (
      <div className="ntp-site-favicon" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
        {letter}
      </div>
    );
  }

  return (
    <div className="ntp-site-favicon">
      <img
        src={getFaviconUrl(url)}
        alt=""
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}

const FALLBACK_SITES: TopSite[] = [
  { title: 'GitHub',        url: 'https://github.com' },
  { title: 'Hacker News',   url: 'https://news.ycombinator.com' },
  { title: 'MDN Web Docs',  url: 'https://developer.mozilla.org' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { title: 'YouTube',       url: 'https://youtube.com' },
  { title: 'Reddit',        url: 'https://reddit.com' },
  { title: 'Wikipedia',     url: 'https://wikipedia.org' },
  { title: 'Figma',         url: 'https://figma.com' },
];

export function TopSites() {
  const [sites, setSites] = useState<TopSite[]>([]);

  useEffect(() => {
    if (window.chrome?.topSites) {
      window.chrome.topSites.get(results => {
        setSites(results.slice(0, 8));
      });
    } else {
      setSites(FALLBACK_SITES);
    }
  }, []);

  if (sites.length === 0) return null;

  return (
    <div className="ntp-top-sites" role="navigation" aria-label="Top sites">
      <div className="ntp-top-sites-grid">
        {sites.map((site) => (
          <a
            key={site.url}
            href={site.url}
            className="ntp-site-item"
            title={site.title}
            aria-label={site.title}
          >
            <SiteIcon url={site.url} title={site.title} />
            <span className="ntp-site-title">{getDomain(site.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
