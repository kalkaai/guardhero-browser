// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// request_interceptor.h — Core request interception logic for EagleEye.
//
// This is the decision engine: given a URL and request context,
// return BLOCK, ALLOW, or MODIFY (strip tracking params).

#ifndef EAGLEEYE_NATIVE_BLOCKER_REQUEST_INTERCEPTOR_H_
#define EAGLEEYE_NATIVE_BLOCKER_REQUEST_INTERCEPTOR_H_

#include <memory>
#include <mutex>
#include <string>
#include <unordered_set>

#include "eagleeye-native/blocker/blocklist_manager.h"
#include "eagleeye-native/blocker/cname_resolver.h"
#include "eagleeye-native/blocker/url_analyzer.h"

namespace eagleeye {

enum class Decision {
  ALLOW,   // Pass request through unchanged
  BLOCK,   // Block the request entirely
  MODIFY,  // Allow but with URL modifications (tracking params stripped)
};

enum class BlockReason {
  NONE,
  BLOCKLIST,        // Domain found on static blocklist
  CNAME_CLOAKING,   // CNAME-cloaked tracker detected
  AI_CLASSIFIER,    // AI engine flagged as tracker (future)
  USER_BLOCKED,     // User manually blocked this domain
};

struct InterceptResult {
  Decision decision;
  BlockReason reason;
  std::string modified_url;         // Only set when decision == MODIFY
  std::vector<std::string> stripped_params; // Params removed (MODIFY only)
  std::string matched_domain;       // The domain that triggered the decision
  bool is_cname_cloaked = false;
};

// RequestContext — metadata about the request for context-aware decisions.
struct RequestContext {
  std::string url;
  std::string initiator_domain;   // Domain of the page making the request
  std::string resource_type;      // "script", "image", "xhr", "stylesheet", etc.
  int tab_id = -1;
};

// RequestInterceptor — evaluates each request and returns a blocking decision.
//
// Call chain:
//   1. Check user allowlist (if allowlisted, always ALLOW)
//   2. Check user blocklist (if user-blocked, always BLOCK)
//   3. Check CNAME cloaking
//   4. Check static blocklist (DomainMatcher)
//   5. Strip tracking params from ALLOWED requests (returns MODIFY if stripped)
//
// Thread safety: All Intercept() calls are thread-safe (read-only after init).
class RequestInterceptor {
 public:
  explicit RequestInterceptor(BlocklistManager* blocklist_manager);
  ~RequestInterceptor();

  // Evaluate a request and return the interception decision.
  InterceptResult Intercept(const RequestContext& context) const;

  // User allowlist management (thread-safe)
  void AllowDomain(const std::string& domain);
  void RemoveAllowedDomain(const std::string& domain);
  bool IsDomainAllowed(const std::string& domain) const;

  // User blocklist management (thread-safe)
  void BlockDomain(const std::string& domain);
  void RemoveBlockedDomain(const std::string& domain);

  // Statistics snapshot (plain values, safe to copy).
  struct Stats {
    int64_t total_requests = 0;
    int64_t blocked = 0;
    int64_t allowed = 0;
    int64_t modified = 0;
    int64_t cname_blocked = 0;
  };
  Stats GetStats() const;
  void ResetStats();

 private:
  BlocklistManager* blocklist_manager_;  // Not owned
  std::unique_ptr<UrlAnalyzer> url_analyzer_;
  std::unique_ptr<CnameResolver> cname_resolver_;

  mutable std::mutex allowlist_mutex_;
  mutable std::mutex blocklist_mutex_;
  std::unordered_set<std::string> user_allowlist_;
  std::unordered_set<std::string> user_blocklist_;

  // Counters are atomic so Intercept() can be called from multiple threads
  // without holding a lock on the hot path.
  mutable std::atomic<int64_t> stat_total_{0};
  mutable std::atomic<int64_t> stat_blocked_{0};
  mutable std::atomic<int64_t> stat_allowed_{0};
  mutable std::atomic<int64_t> stat_modified_{0};
  mutable std::atomic<int64_t> stat_cname_blocked_{0};

  // Extract hostname from a URL string.
  static std::string ExtractHost(const std::string& url);
};

}  // namespace eagleeye

#endif  // EAGLEEYE_NATIVE_BLOCKER_REQUEST_INTERCEPTOR_H_
