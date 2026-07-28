// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// chrome/common/guardhero_url_constants.h
//
// Shared guardhero:// URL constants used across the codebase — renderer,
// browser process, and utility processes can all include this header.
//
// For browser-process-only declarations (e.g., handler registration,
// WebUI bindings) see chrome/browser/guardhero/guardhero_url_constants.h.
//
// Usage:
//   #include "chrome/common/guardhero_url_constants.h"
//   GURL url(guardhero::kGuardHeroNewTabURL);
//
// Implementation:
//   chrome/common/guardhero_url_constants.cc  (add to BUILD.gn as a source)

#ifndef CHROME_COMMON_GUARDHERO_URL_CONSTANTS_H_
#define CHROME_COMMON_GUARDHERO_URL_CONSTANTS_H_

namespace guardhero {

// ── URL scheme ────────────────────────────────────────────────────────────────
// The custom scheme used for all Guard Hero internal pages.
// Registered in chrome/common/url_constants.cc via AddStandardScheme().
extern const char kGuardHeroScheme[];           // "guardhero"

// ── Page hosts ────────────────────────────────────────────────────────────────
// Each host corresponds to a WebUI page served under guardhero://<host>.

extern const char kGuardHeroNewTabHost[];       // "newtab"
extern const char kGuardHeroSettingsHost[];     // "settings"
extern const char kGuardHeroStatsHost[];        // "stats"
extern const char kGuardHeroAuditHost[];        // "audit"
extern const char kGuardHeroAiSessionsHost[];   // "ai-sessions"
extern const char kGuardHeroPromptsHost[];      // "prompts"
extern const char kGuardHeroReaderHost[];       // "reader"
extern const char kGuardHeroDevToolsHost[];     // "devtools"  (v1.1+)
extern const char kGuardHeroPerformanceHost[];  // "performance" (v1.2+)
extern const char kGuardHeroAiPanelHost[];      // "ai-panel" (v1.3+)
extern const char kGuardHeroAiShieldHost[];     // "ai-shield" (v1.3+)
extern const char kGuardHeroSummarizerHost[];   // "summarizer" (v1.3+)

// ── Full URL constants ─────────────────────────────────────────────────────────
// Pre-built full URL strings for use in GURL constructors or string comparisons.

extern const char kGuardHeroNewTabURL[];        // "guardhero://newtab"
extern const char kGuardHeroSettingsURL[];      // "guardhero://settings"
extern const char kGuardHeroStatsURL[];         // "guardhero://stats"
extern const char kGuardHeroAuditURL[];         // "guardhero://audit"
extern const char kGuardHeroAiSessionsURL[];    // "guardhero://ai-sessions"
extern const char kGuardHeroPromptsURL[];       // "guardhero://prompts"
extern const char kGuardHeroReaderURL[];        // "guardhero://reader"
extern const char kGuardHeroDevToolsURL[];      // "guardhero://devtools"
extern const char kGuardHeroPerformanceURL[];   // "guardhero://performance"
extern const char kGuardHeroAiPanelURL[];       // "guardhero://ai-panel"

// ── External URLs ─────────────────────────────────────────────────────────────
// HTTPS URLs for Guard Hero services referenced from renderer-accessible code.
// Keep in sync with chrome/browser/guardhero/guardhero_url_constants.h.

// Update server (Omaha-compatible endpoint)
extern const char kGuardHeroUpdateServerURL[];  // "https://updates.guardhero.app/omaha"

// Blocklist CDN base URL (fetched by blocklist_manager)
extern const char kGuardHeroBlocklistBaseURL[]; // "https://lists.guardhero.app/v1"

// Privacy policy and support pages (opened in new tab from UI)
extern const char kGuardHeroPrivacyPolicyURL[]; // "https://guardhero.app/privacy"
extern const char kGuardHeroSupportURL[];       // "https://guardhero.app/support"
extern const char kGuardHeroReleaseNotesURL[];  // "https://guardhero.app/releases"

// ── Miscellaneous constants ────────────────────────────────────────────────────

// Product version string, kept in sync with DEPS and build metadata.
extern const char kGuardHeroVersion[];          // "1.0.0"

// Chrome extension ID for the Guard Hero companion extension (if any).
extern const char kGuardHeroExtensionId[];      // "ghbcpgkfcnmbhhoikiokhbglnpajmdhe"

}  // namespace guardhero

#endif  // CHROME_COMMON_GUARDHERO_URL_CONSTANTS_H_
