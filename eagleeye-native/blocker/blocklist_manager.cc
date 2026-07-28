// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "eagleeye-native/blocker/blocklist_manager.h"

#include <algorithm>
#include <fstream>
#include <regex>
#include <sstream>

namespace eagleeye {

BlocklistManager::BlocklistManager() = default;
BlocklistManager::~BlocklistManager() = default;

// static
std::string BlocklistManager::ExtractAbpDomain(const std::string& line) {
  // ABP format: ||domain.com^  or  ||domain.com^$third-party
  if (line.size() > 4 && line[0] == '|' && line[1] == '|') {
    std::string rest = line.substr(2);
    size_t caret = rest.find('^');
    if (caret != std::string::npos) {
      std::string domain = rest.substr(0, caret);
      // Validate: no path separators, no wildcards
      if (domain.find('/') == std::string::npos &&
          domain.find('*') == std::string::npos &&
          domain.find('.') != std::string::npos) {
        return domain;
      }
    }
  }
  return "";
}

// static
std::vector<std::string> BlocklistManager::ParseFile(const std::string& path,
                                                       BlocklistStats& stats) {
  std::vector<std::string> domains;
  std::ifstream file(path);
  if (!file.is_open()) {
    stats.load_success = false;
    return domains;
  }

  stats.loaded_path = path;
  std::string line;

  while (std::getline(file, line)) {
    ++stats.total_lines_parsed;

    // Trim whitespace
    line.erase(0, line.find_first_not_of(" \t\r\n"));
    if (line.empty()) continue;

    // Skip comment lines
    if (line[0] == '#' || line[0] == '!' || line[0] == '[') {
      ++stats.comment_lines_skipped;
      continue;
    }

    // Strip inline comment
    size_t comment = line.find(" #");
    if (comment != std::string::npos) {
      line = line.substr(0, comment);
    }
    line.erase(line.find_last_not_of(" \t\r\n") + 1);
    if (line.empty()) continue;

    std::string domain;

    // ABP format: ||domain.com^
    if (line.size() >= 2 && line[0] == '|' && line[1] == '|') {
      domain = ExtractAbpDomain(line);
    } else {
      // Plain domain format — validate it looks like a domain
      bool valid = true;
      for (char c : line) {
        if (!std::isalnum(c) && c != '.' && c != '-' && c != '_') {
          valid = false;
          break;
        }
      }
      if (valid && line.find('.') != std::string::npos) {
        domain = line;
      }
    }

    if (domain.empty()) {
      ++stats.invalid_lines_skipped;
      continue;
    }

    domains.push_back(domain);
    ++stats.total_domains;
  }

  stats.load_success = true;
  return domains;
}

// static
std::unique_ptr<DomainMatcher> BlocklistManager::BuildMatcher(
    const std::vector<std::string>& domains) {
  auto matcher = std::make_unique<DomainMatcher>();
  for (const auto& domain : domains) {
    matcher->AddDomain(domain);
  }
  matcher->Finalize();
  return matcher;
}

BlocklistStats BlocklistManager::Load(const std::string& path) {
  BlocklistStats stats;
  auto domains = ParseFile(path, stats);

  if (stats.load_success) {
    auto matcher = BuildMatcher(domains);
    active_matcher_ = std::move(matcher);
    loaded_paths_ = {path};

    if (update_callback_) {
      update_callback_(stats);
    }
  }

  return stats;
}

std::vector<BlocklistStats> BlocklistManager::LoadAll(
    const std::vector<std::string>& paths) {
  std::vector<BlocklistStats> all_stats;
  std::vector<std::string> all_domains;
  loaded_paths_ = paths;

  for (const auto& path : paths) {
    BlocklistStats stats;
    auto domains = ParseFile(path, stats);
    all_stats.push_back(stats);
    if (stats.load_success) {
      all_domains.insert(all_domains.end(), domains.begin(), domains.end());
    }
  }

  // Remove duplicates
  std::sort(all_domains.begin(), all_domains.end());
  all_domains.erase(std::unique(all_domains.begin(), all_domains.end()),
                    all_domains.end());

  if (!all_domains.empty()) {
    active_matcher_ = BuildMatcher(all_domains);
  }

  return all_stats;
}

const DomainMatcher* BlocklistManager::GetMatcher() const {
  return active_matcher_.get();
}

void BlocklistManager::SetUpdateCallback(UpdateCallback callback) {
  update_callback_ = std::move(callback);
}

size_t BlocklistManager::TotalDomains() const {
  return active_matcher_ ? active_matcher_->DomainCount() : 0;
}

void BlocklistManager::Reload() {
  if (reload_in_progress_.exchange(true)) {
    return;  // Already reloading
  }
  LoadAll(loaded_paths_);
  reload_in_progress_ = false;
}

}  // namespace eagleeye
