// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// guardhero_api.h — Implements the chrome.guardhero.* JavaScript API bridge.
//
// Exposes blocking stats and controls to the browser UI (NTP, popup, settings).
// Uses Chromium's V8/Mojo bridge mechanism.

#ifndef EAGLEEYE_NATIVE_BRIDGE_GUARDHERO_API_H_
#define EAGLEEYE_NATIVE_BRIDGE_GUARDHERO_API_H_

#include <cstdint>
#include <string>
#include <vector>

namespace guardhero {
namespace bridge {

// SessionStats — statistics for the current browser session.
struct SessionStats {
  int64_t blocked = 0;
  int64_t modified = 0;           // Requests with tracking params stripped
  int64_t allowed = 0;
  int64_t cname_blocked = 0;
  std::vector<std::string> top_blocked_domains;  // Up to 20
};

// PageStats — per-tab request statistics.
struct PageStats {
  int tab_id = -1;
  int64_t blocked = 0;
  std::vector<std::string> blocked_trackers;  // Full URLs/domains blocked
};

// AllTimeStats — persistent statistics (survives session restarts).
struct AllTimeStats {
  int64_t total_blocked = 0;
  int64_t sessions = 0;
  std::string first_install_date;
};

// GuardHeroApiHandler — handles chrome.guardhero.* API calls from WebUI.
//
// JavaScript API surface:
//   chrome.guardhero.getSessionStats()           → SessionStats
//   chrome.guardhero.getPageStats(tabId)         → PageStats
//   chrome.guardhero.getAllTimeStats()            → AllTimeStats
//   chrome.guardhero.setBlockingEnabled(bool)     → void
//   chrome.guardhero.allowDomain(domain)          → void
//   chrome.guardhero.blockDomain(domain)          → void
//   chrome.guardhero.onRequestEvent.addListener() → event stream
class GuardHeroApiHandler {
 public:
  GuardHeroApiHandler();
  ~GuardHeroApiHandler();

  // ── Stats queries ─────────────────────────────────────────────────────────
  SessionStats GetSessionStats() const;
  PageStats GetPageStats(int tab_id) const;
  AllTimeStats GetAllTimeStats() const;

  // ── Controls ──────────────────────────────────────────────────────────────
  void SetBlockingEnabled(bool enabled);
  bool IsBlockingEnabled() const;

  void AllowDomain(const std::string& domain);
  void BlockDomain(const std::string& domain);

  // ── Persistence ───────────────────────────────────────────────────────────
  // Called on browser startup to load persisted all-time stats.
  void LoadPersistedStats(const std::string& profile_path);
  // Called periodically and on shutdown to save all-time stats.
  void PersistStats(const std::string& profile_path) const;

  // Singleton accessor (registered during browser init)
  static GuardHeroApiHandler* GetInstance();
  static void SetInstance(GuardHeroApiHandler* instance);

 private:
  bool blocking_enabled_ = true;
  AllTimeStats all_time_stats_;
  mutable SessionStats session_stats_;

  static GuardHeroApiHandler* g_instance_;
};

}  // namespace bridge
}  // namespace guardhero

#endif  // EAGLEEYE_NATIVE_BRIDGE_GUARDHERO_API_H_
