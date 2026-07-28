// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// AllowSiteButton.tsx — Add current domain to the EagleEye allowlist.

import { useState } from 'react';

interface AllowSiteButtonProps {
  domain?: string;
  onAllowed?: () => void;
}

export function AllowSiteButton({ domain, onAllowed }: AllowSiteButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  async function handleAllow() {
    if (!domain) return;
    setStatus('loading');
    try {
      await window.chrome?.guardhero?.allowDomain(domain);
      setStatus('done');
      onAllowed?.();
    } catch {
      setStatus('idle');
    }
  }

  return (
    <button
      className="popup-action-btn allow"
      onClick={handleAllow}
      disabled={status !== 'idle'}
      aria-label={`Allow ${domain ?? 'this site'}`}
    >
      {status === 'loading' ? '...' : status === 'done' ? '✓ Allowed' : 'Allow this site'}
    </button>
  );
}
