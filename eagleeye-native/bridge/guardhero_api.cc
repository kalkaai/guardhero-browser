// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "eagleeye-native/bridge/guardhero_api.h"

#include <fstream>
#include <sstream>

namespace guardhero {
namespace bridge {

// static
GuardHeroApiHandler* GuardHeroApiHandler::g_instance_ = nullptr;

// static
GuardHeroApiHandler* GuardHeroApiHandler::GetInstance() {
  return g_instance_;
}

// static
void GuardHeroApiHandler::SetInstance(GuardHeroApiHandler* instance) {
  g_instance_ = instance;
}

GuardHeroApiHandler::GuardHeroApiHandler() = default;
GuardHeroApiHandler::~GuardHeroApiHandler() = default;

SessionStats GuardHeroApiHandler::GetSessionStats() const {
  return session_stats_;
}

PageStats GuardHeroApiHandler::GetPageStats(int tab_id) const {
  PageStats stats;
  stats.tab_id = tab_id;
  // In the full implementation, this queries the per-tab request log
  // maintained by EagleEyeInterceptor. Stub returns session-level data.
  stats.blocked = session_stats_.blocked;
  return stats;
}

AllTimeStats GuardHeroApiHandler::GetAllTimeStats() const {
  AllTimeStats combined = all_time_stats_;
  combined.total_blocked += session_stats_.blocked;
  return combined;
}

void GuardHeroApiHandler::SetBlockingEnabled(bool enabled) {
  blocking_enabled_ = enabled;
}

bool GuardHeroApiHandler::IsBlockingEnabled() const {
  return blocking_enabled_;
}

void GuardHeroApiHandler::AllowDomain(const std::string& domain) {
  // Delegates to EagleEyeInterceptor's RequestInterceptor
  // In full implementation, calls EagleEyeInterceptor::GetInterceptor()->AllowDomain()
}

void GuardHeroApiHandler::BlockDomain(const std::string& domain) {
  // Delegates to EagleEyeInterceptor's RequestInterceptor
}

void GuardHeroApiHandler::LoadPersistedStats(const std::string& profile_path) {
  std::string stats_path = profile_path + "/guardhero_stats.json";
  std::ifstream file(stats_path);
  if (!file.is_open()) return;

  // Simple JSON parsing (in full impl, use base::JSONReader)
  std::string line;
  while (std::getline(file, line)) {
    if (line.find("\"total_blocked\"") != std::string::npos) {
      size_t colon = line.find(':');
      if (colon != std::string::npos) {
        try {
          all_time_stats_.total_blocked = std::stoll(line.substr(colon + 1));
        } catch (...) {}
      }
    }
    if (line.find("\"sessions\"") != std::string::npos) {
      size_t colon = line.find(':');
      if (colon != std::string::npos) {
        try {
          all_time_stats_.sessions = std::stoll(line.substr(colon + 1));
        } catch (...) {}
      }
    }
  }
  ++all_time_stats_.sessions;
}

void GuardHeroApiHandler::PersistStats(const std::string& profile_path) const {
  std::string stats_path = profile_path + "/guardhero_stats.json";
  std::ofstream file(stats_path);
  if (!file.is_open()) return;

  AllTimeStats combined = GetAllTimeStats();
  file << "{\n";
  file << "  \"total_blocked\": " << combined.total_blocked << ",\n";
  file << "  \"sessions\": " << combined.sessions << ",\n";
  file << "  \"first_install_date\": \"" << combined.first_install_date << "\"\n";
  file << "}\n";
}

}  // namespace bridge
}  // namespace guardhero
