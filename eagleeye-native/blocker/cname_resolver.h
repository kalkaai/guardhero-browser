// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// cname_resolver.h — Detect CNAME-cloaked trackers.
//
// CNAME cloaking is a technique where first-party subdomains are aliased
// (via DNS CNAME record) to third-party tracker domains. For example:
//   metrics.yoursite.com → doubleclick.net (via CNAME)
//
// This makes the request appear to be first-party at the network level.
// We detect cloaking by maintaining a map of known CNAME targets.

#ifndef EAGLEEYE_NATIVE_BLOCKER_CNAME_RESOLVER_H_
#define EAGLEEYE_NATIVE_BLOCKER_CNAME_RESOLVER_H_

#include <functional>
#include <memory>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace eagleeye {

struct CnameResolution {
  std::string original_domain;
  std::string resolved_domain;   // Final CNAME target
  std::vector<std::string> chain; // Full CNAME chain
  bool is_cloaked;               // True if any chain member is a known tracker
  std::string cloaking_domain;   // The tracker domain in the chain
};

// CnameResolver — detects CNAME-based tracker cloaking.
//
// Two modes of operation:
// 1. Static map: Known CNAME relationships from our curated list.
//    This handles the most common cases with zero DNS latency.
// 2. Dynamic DNS resolution: For unknown subdomains, perform async
//    DNS lookup to check CNAME chains (hooks into Chromium's host resolver).
class CnameResolver {
 public:
  CnameResolver();
  ~CnameResolver();

  // Check if a domain is CNAME-cloaking a known tracker.
  // Uses only the static map — sub-millisecond, synchronous.
  CnameResolution CheckStatic(const std::string& domain) const;

  // Add a known CNAME cloaking relationship to the static map.
  // source: the first-party subdomain (e.g., "metrics.yoursite.com")
  // target: the tracker it resolves to (e.g., "doubleclick.net")
  void AddKnownCloaking(const std::string& source, const std::string& target);

  // Add a known tracker domain (used to identify cloaking targets).
  void AddTrackerDomain(const std::string& domain);

  // Returns true if the domain is a known tracker target.
  bool IsKnownTracker(const std::string& domain) const;

  // Load known cloaking pairs from a flat file.
  // Format: one entry per line: "source.domain.com -> tracker.com"
  bool LoadFromFile(const std::string& path);

  // Returns count of known static cloaking relationships.
  size_t StaticMapSize() const { return static_cname_map_.size(); }

 private:
  // Map: first-party subdomain pattern → known tracker target
  std::unordered_map<std::string, std::string> static_cname_map_;

  // Set of known tracker domains (for identifying cloaking targets)
  std::unordered_set<std::string> known_trackers_;

  // Check if a domain suffix matches any entry in the static map
  std::string FindCnameTarget(const std::string& domain) const;
};

}  // namespace eagleeye

#endif  // EAGLEEYE_NATIVE_BLOCKER_CNAME_RESOLVER_H_
