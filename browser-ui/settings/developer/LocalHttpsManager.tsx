// Copyright (c) 2025 Guard Hero. All rights reserved.
// LocalHttpsManager.tsx — Settings UI for the local HTTPS / mkcert feature.

import { useState, useEffect } from 'react';

interface CAInfo {
  active: boolean;
  createdDate: string | null;
}

interface CertEntry {
  domain: string;
  validUntil: string;
}

// In production these call chrome.guardhero.devCerts.* via WebUI message handler.
const mockDevCerts = {
  getCA: async (): Promise<CAInfo> => ({
    active: true,
    createdDate: '2026-01-15',
  }),
  listCerts: async (): Promise<CertEntry[]> => [
    { domain: 'localhost', validUntil: '2027-01-15' },
    { domain: 'myapp.local', validUntil: '2027-01-15' },
  ],
  generateCA: async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 800));
  },
  exportCA: async (): Promise<void> => {
    console.log('[GuardHero Mock] Exporting CA cert');
  },
  issueCert: async (domain: string): Promise<void> => {
    await new Promise((r) => setTimeout(r, 500));
    console.log(`[GuardHero Mock] Issued cert for ${domain}`);
  },
  revokeCert: async (domain: string): Promise<void> => {
    console.log(`[GuardHero Mock] Revoked cert for ${domain}`);
  },
};

function getDevCertsApi() {
  return mockDevCerts;
}

export function LocalHttpsManager() {
  const [caInfo, setCaInfo] = useState<CAInfo | null>(null);
  const [certs, setCerts] = useState<CertEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [issuing, setIssuing] = useState(false);

  const api = getDevCertsApi();

  useEffect(() => {
    api.getCA().then(setCaInfo);
    api.listCerts().then(setCerts);
  }, []);

  const handleRegenerateCA = async () => {
    setLoading(true);
    await api.generateCA();
    const info = await api.getCA();
    setCaInfo(info);
    setLoading(false);
  };

  const handleExportCA = async () => {
    await api.exportCA();
  };

  const handleIssueCert = async () => {
    if (!newDomain.trim()) return;
    setIssuing(true);
    await api.issueCert(newDomain.trim());
    const updated = await api.listCerts();
    setCerts(updated);
    setNewDomain('');
    setIssuing(false);
  };

  const handleRevokeCert = async (domain: string) => {
    await api.revokeCert(domain);
    setCerts((prev) => prev.filter((c) => c.domain !== domain));
  };

  return (
    <div className="lhm-root">
      <div className="settings-group">
        <div className="settings-group-title">Local CA Status</div>

        <div className="settings-row">
          <div className="settings-row-info">
            <span className="settings-row-label">Local Certificate Authority</span>
            <span className="settings-row-desc">
              Browser-only trust. Does not modify the OS keychain.
            </span>
          </div>
          {caInfo && (
            <span
              className={`lhm-ca-status${caInfo.active ? ' lhm-ca-active' : ' lhm-ca-inactive'}`}
            >
              {caInfo.active
                ? `✓ Active${caInfo.createdDate ? ` (created ${caInfo.createdDate})` : ''}`
                : '✗ Not generated'}
            </span>
          )}
        </div>

        <div className="settings-row">
          <button
            className="settings-btn-secondary"
            onClick={handleRegenerateCA}
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Regenerate CA'}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleExportCA}
            disabled={!caInfo?.active}
          >
            Export CA cert
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Issued Certificates</div>

        {certs.length === 0 ? (
          <div className="settings-desc">No certificates issued yet.</div>
        ) : (
          <table className="lhm-cert-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Valid until</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => (
                <tr key={cert.domain} className="lhm-cert-row">
                  <td className="lhm-cert-domain">{cert.domain}</td>
                  <td className="lhm-cert-expiry">{cert.validUntil}</td>
                  <td>
                    <button
                      className="settings-btn-remove"
                      onClick={() => handleRevokeCert(cert.domain)}
                      title="Revoke certificate"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="settings-input-row" style={{ marginTop: 12 }}>
          <input
            className="settings-input"
            placeholder="localhost, myapp.local, *.dev.local"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIssueCert()}
          />
          <button
            className="settings-btn-primary"
            onClick={handleIssueCert}
            disabled={issuing || !newDomain.trim() || !caInfo?.active}
          >
            {issuing ? 'Issuing…' : '+ Issue cert'}
          </button>
        </div>
      </div>

      <style>{`
        .lhm-ca-status { font-size: 13px; font-weight: 500; }
        .lhm-ca-active { color: #27C174; }
        .lhm-ca-inactive { color: #FF4B6E; }
        .lhm-cert-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
        .lhm-cert-table th { text-align: left; padding: 4px 8px; font-size: 11px; font-weight: 600; color: #8892A4; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .lhm-cert-row { border-bottom: 1px solid rgba(255,255,255,0.04); }
        .lhm-cert-domain { padding: 7px 8px; font-family: monospace; font-size: 13px; color: var(--accent, #00D4FF); }
        .lhm-cert-expiry { padding: 7px 8px; color: #8892A4; font-size: 12px; }
      `}</style>
    </div>
  );
}
