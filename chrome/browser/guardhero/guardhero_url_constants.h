// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// guardhero_url_constants.h — Guard Hero URL scheme and page constants.

#ifndef CHROME_BROWSER_GUARDHERO_GUARDHERO_URL_CONSTANTS_H_
#define CHROME_BROWSER_GUARDHERO_GUARDHERO_URL_CONSTANTS_H_

namespace guardhero {

// ── Scheme ────────────────────────────────────────────────────────────────────
extern const char kGuardHeroScheme[];         // "guardhero"

// ── Hosts (page names in the guardhero:// scheme) ─────────────────────────────
extern const char kGuardHeroNewTabHost[];     // "newtab"
extern const char kGuardHeroSettingsHost[];   // "settings"
extern const char kGuardHeroStatsHost[];      // "stats"
extern const char kGuardHeroAuditHost[];      // "audit"
extern const char kGuardHeroAiSessionsHost[]; // "ai-sessions"
extern const char kGuardHeroPromptsHost[];    // "prompts"
extern const char kGuardHeroReaderHost[];     // "reader"

// ── Full URL constants ─────────────────────────────────────────────────────────
extern const char kGuardHeroNewTabURL[];      // "guardhero://newtab"
extern const char kGuardHeroSettingsURL[];    // "guardhero://settings"
extern const char kGuardHeroStatsURL[];       // "guardhero://stats"
extern const char kGuardHeroAuditURL[];       // "guardhero://audit"
extern const char kGuardHeroAiSessionsURL[];  // "guardhero://ai-sessions"
extern const char kGuardHeroPromptsURL[];     // "guardhero://prompts"
extern const char kGuardHeroReaderURL[];      // "guardhero://reader"

// ── Version string ─────────────────────────────────────────────────────────────
extern const char kGuardHeroVersion[];        // "1.0.0"

// ── Update server ─────────────────────────────────────────────────────────────
extern const char kGuardHeroUpdateServerURL[]; // "https://updates.guardhero.app/omaha"

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_GUARDHERO_URL_CONSTANTS_H_
