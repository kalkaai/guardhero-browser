// Copyright (c) 2025 Guard Hero. All rights reserved.
//
// ReportButton.tsx — Open feedback / false-positive report form.

interface ReportButtonProps {
  currentUrl?: string;
}

export function ReportButton({ currentUrl }: ReportButtonProps) {
  function handleReport() {
    // Opens the Guard Hero feedback form in a new tab
    const params = currentUrl ? `?url=${encodeURIComponent(currentUrl)}` : '';
    window.open(`https://guardhero.app/report${params}`, '_blank', 'noopener');
  }

  return (
    <button className="popup-action-btn report" onClick={handleReport}
            aria-label="Report a false positive">
      Report
    </button>
  );
}
