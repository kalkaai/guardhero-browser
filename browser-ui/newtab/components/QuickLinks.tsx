// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// QuickLinks.tsx — Fixed quick-access links to Guard Hero products & settings.

interface QuickLink {
  label: string;
  href: string;
  color?: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'EagleEye',  href: 'guardhero://settings#eagleeye',  color: 'var(--accent)' },
  { label: 'OPi-one',   href: 'guardhero://settings#opione',    color: 'var(--success)' },
  { label: 'Settings',  href: 'guardhero://settings',            color: 'var(--text-muted)' },
  { label: 'AI Tools',  href: 'guardhero://settings#ai',         color: '#A78BFA' },
];

export function QuickLinks() {
  return (
    <nav className="ntp-quick-links" aria-label="Guard Hero quick links">
      {QUICK_LINKS.map(link => (
        <a
          key={link.href}
          href={link.href}
          className="ntp-quick-link"
          style={{ '--link-color': link.color } as React.CSSProperties}
        >
          <span className="ntp-quick-link-dot" style={{ background: link.color }} />
          {link.label}
        </a>
      ))}
    </nav>
  );
}
