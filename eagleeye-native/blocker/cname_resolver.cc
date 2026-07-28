// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "eagleeye-native/blocker/cname_resolver.h"

#include <algorithm>
#include <fstream>
#include <sstream>

namespace eagleeye {

CnameResolver::CnameResolver() {
  // Pre-load well-known CNAME cloaking relationships.
  // These are sourced from public research (e.g., by Lena et al. 2021).
  const std::vector<std::pair<std::string, std::string>> kKnownCloaking = {
    // Criteo CNAME cloaking patterns
    {"cm.criteo.com",            "widget.criteo.com"},
    {"dis.criteo.com",           "widget.criteo.com"},
    // Adobe Experience Cloud
    {"metrics",                  "2o7.net"},
    {"om",                       "2o7.net"},
    // Eulerian Analytics
    {"www.ea",                   "eanalytics.de"},
    // Keyade
    {"tracker.keyade.com",       "trackerfile.com"},
    // Custom patterns used in major CNAME cloaking incidents (2020-2024)
    {"segment",                  "analytics.segment.com"},
    {"heap",                     "heapanalytics.com"},
    {"amplitude",                "cdn.amplitude.com"},
    {"fullstory",                "rs.fullstory.com"},
    {"hotjar",                   "vars.hotjar.com"},
  };

  for (const auto& [source, target] : kKnownCloaking) {
    static_cname_map_[source] = target;
  }

  // Known tracker domains used as CNAME targets
  const std::vector<std::string> kTrackerTargets = {
    "2o7.net", "omtrdc.net", "demdex.net",  // Adobe
    "doubleclick.net",                        // Google
    "criteo.com", "widget.criteo.com",        // Criteo
    "eanalytics.de",                          // Eulerian
    "heapanalytics.com",                      // Heap
    "cdn.amplitude.com",                      // Amplitude
    "rs.fullstory.com",                       // FullStory
    "vars.hotjar.com",                        // Hotjar
    "analytics.segment.com",                  // Segment
  };

  for (const auto& t : kTrackerTargets) {
    known_trackers_.insert(t);
  }
}

CnameResolver::~CnameResolver() = default;

void CnameResolver::AddKnownCloaking(const std::string& source,
                                      const std::string& target) {
  std::string lower_source = source;
  std::transform(lower_source.begin(), lower_source.end(), lower_source.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  static_cname_map_[lower_source] = target;
  known_trackers_.insert(target);
}

void CnameResolver::AddTrackerDomain(const std::string& domain) {
  known_trackers_.insert(domain);
}

bool CnameResolver::IsKnownTracker(const std::string& domain) const {
  return known_trackers_.count(domain) > 0;
}

std::string CnameResolver::FindCnameTarget(const std::string& domain) const {
  // Exact match
  auto it = static_cname_map_.find(domain);
  if (it != static_cname_map_.end()) {
    return it->second;
  }

  // Try matching subdomain prefixes
  // e.g., domain = "metrics.example.com" → check "metrics" as prefix
  size_t dot = domain.find('.');
  if (dot != std::string::npos) {
    std::string prefix = domain.substr(0, dot);
    it = static_cname_map_.find(prefix);
    if (it != static_cname_map_.end()) {
      return it->second;
    }
  }

  return "";
}

CnameResolution CnameResolver::CheckStatic(const std::string& domain) const {
  CnameResolution result;
  result.original_domain = domain;
  result.is_cloaked = false;

  std::string lower_domain = domain;
  std::transform(lower_domain.begin(), lower_domain.end(), lower_domain.begin(),
                 [](unsigned char c) { return std::tolower(c); });

  std::string target = FindCnameTarget(lower_domain);
  if (!target.empty()) {
    result.resolved_domain = target;
    result.chain = {domain, target};
    result.is_cloaked = IsKnownTracker(target);
    if (result.is_cloaked) {
      result.cloaking_domain = target;
    }
  } else {
    result.resolved_domain = domain;
    result.chain = {domain};
  }

  return result;
}

bool CnameResolver::LoadFromFile(const std::string& path) {
  std::ifstream file(path);
  if (!file.is_open()) return false;

  std::string line;
  while (std::getline(file, line)) {
    // Strip comments and trim
    auto comment = line.find('#');
    if (comment != std::string::npos) line = line.substr(0, comment);
    // Trim whitespace
    line.erase(0, line.find_first_not_of(" \t"));
    line.erase(line.find_last_not_of(" \t") + 1);
    if (line.empty()) continue;

    // Parse "source -> target"
    auto arrow = line.find(" -> ");
    if (arrow == std::string::npos) continue;
    std::string source = line.substr(0, arrow);
    std::string target = line.substr(arrow + 4);
    // Trim again
    source.erase(source.find_last_not_of(" \t") + 1);
    target.erase(0, target.find_first_not_of(" \t"));
    if (!source.empty() && !target.empty()) {
      AddKnownCloaking(source, target);
    }
  }
  return true;
}

}  // namespace eagleeye
