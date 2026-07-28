// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// blocklist_manager.h — Loads, parses, and hot-reloads EagleEye blocklists.

#ifndef EAGLEEYE_NATIVE_BLOCKER_BLOCKLIST_MANAGER_H_
#define EAGLEEYE_NATIVE_BLOCKER_BLOCKLIST_MANAGER_H_

#include <atomic>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "eagleeye-native/blocker/domain_matcher.h"

namespace eagleeye {

struct BlocklistStats {
  size_t total_domains = 0;
  size_t total_lines_parsed = 0;
  size_t comment_lines_skipped = 0;
  size_t invalid_lines_skipped = 0;
  std::string loaded_path;
  bool load_success = false;
};

// BlocklistManager — manages loading and hot-reloading of domain blocklists.
//
// File format (one per line):
//   doubleclick.net          # direct domain
//   # comment line           # ignored
//   google-analytics.com
//   ||tracker.com^           # ABP filter format (domain extracted)
//
// Hot-reload: file watcher detects changes and rebuilds the DomainMatcher
// on a background thread. The active matcher is swapped atomically.
class BlocklistManager {
 public:
  using UpdateCallback = std::function<void(const BlocklistStats&)>;

  BlocklistManager();
  ~BlocklistManager();

  // Load a blocklist file synchronously. Returns load stats.
  // path: absolute path to the blocklist file.
  BlocklistStats Load(const std::string& path);

  // Load multiple blocklist files (additive — domains merged).
  std::vector<BlocklistStats> LoadAll(const std::vector<std::string>& paths);

  // Returns the active DomainMatcher (thread-safe, atomic swap on reload).
  // Caller must not hold a reference across a reload; call again as needed.
  const DomainMatcher* GetMatcher() const;

  // Register a callback invoked after a successful hot-reload.
  void SetUpdateCallback(UpdateCallback callback);

  // Returns combined stats from all loaded files.
  size_t TotalDomains() const;

  // Reload the current files from disk (used for hot-reload).
  void Reload();

 private:
  // Parse a single blocklist file into domain strings.
  // Handles plain-domain format and ABP ||domain^ format.
  static std::vector<std::string> ParseFile(const std::string& path,
                                             BlocklistStats& stats);

  // Extract domain from ABP filter line (e.g., "||tracker.com^" → "tracker.com")
  static std::string ExtractAbpDomain(const std::string& line);

  // Build a new DomainMatcher from a set of domain strings.
  static std::unique_ptr<DomainMatcher> BuildMatcher(
      const std::vector<std::string>& domains);

  std::shared_ptr<DomainMatcher> active_matcher_;
  std::vector<std::string> loaded_paths_;
  UpdateCallback update_callback_;
  mutable std::atomic<bool> reload_in_progress_{false};
};

}  // namespace eagleeye

#endif  // EAGLEEYE_NATIVE_BLOCKER_BLOCKLIST_MANAGER_H_
