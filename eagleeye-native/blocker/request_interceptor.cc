// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// request_interceptor.cc — Core request interception logic for EagleEye.
//
// Decision pipeline (in order):
//   1. Sanitize / extract host from URL
//   2. User allowlist check (ALLOW immediately, skip all other checks)
//   3. User blocklist check (BLOCK immediately)
//   4. CNAME cloaking check (static map, sub-millisecond)
//   5. Static blocklist check via DomainMatcher (Bloom + hash, < 1ms)
//   6. If ALLOW: strip tracking params → MODIFY if any were stripped
//
// Thread safety: stats use std::atomic; allowlist/blocklist use std::mutex.

#include "eagleeye-native/blocker/request_interceptor.h"

#include <algorithm>
#include <cctype>
#include <mutex>
#include <string>

namespace eagleeye {

namespace {

// ── Minimal URL host extraction ──────────────────────────────────────────────
// In production the Chromium bridge calls GURL::host() and passes only the
// hostname in RequestContext::url (fast no-op path — no "://" found).
// In unit tests, full URLs are passed so we do a proper extraction here.
std::string ExtractHostFromUrl(const std::string& url) {
  size_t scheme_end = url.find("://");
  size_t start = (scheme_end == std::string::npos) ? 0 : scheme_end + 3;

  // Skip optional user-info ("user:pass@")
  size_t at = url.find('@', start);
  size_t path_start = url.find('/', start);
  if (at != std::string::npos &&
      (path_start == std::string::npos || at < path_start)) {
    start = at + 1;
  }

  // End of host: first of '/', '?', '#', ':'
  size_t end = url.size();
  for (char delim : {'/', '?', '#', ':'}) {
    size_t pos = url.find(delim, start);
    if (pos != std::string::npos && pos < end)
      end = pos;
  }

  std::string host = url.substr(start, end - start);

  std::transform(host.begin(), host.end(), host.begin(),
                 [](unsigned char c) { return std::tolower(c); });

  // Strip trailing FQDN dot
  if (!host.empty() && host.back() == '.')
    host.pop_back();

  // Strip www. prefix
  if (host.rfind("www.", 0) == 0)
    host = host.substr(4);

  return host;
}

}  // namespace

// ── Constructor / Destructor ─────────────────────────────────────────────────

RequestInterceptor::RequestInterceptor(BlocklistManager* blocklist_manager)
    : blocklist_manager_(blocklist_manager),
      url_analyzer_(std::make_unique<UrlAnalyzer>()),
      cname_resolver_(std::make_unique<CnameResolver>()) {}

RequestInterceptor::~RequestInterceptor() = default;

// ── Core decision engine ─────────────────────────────────────────────────────

InterceptResult RequestInterceptor::Intercept(
    const RequestContext& context) const {
  ++stat_total_;

  const std::string host = ExtractHost(context.url);

  InterceptResult result;
  result.matched_domain = host;
  result.decision = Decision::ALLOW;
  result.reason = BlockReason::NONE;

  if (host.empty()) {
    ++stat_allowed_;
    return result;
  }

  // ── Step 1: User allowlist ───────────────────────────────────────────────
  {
    std::lock_guard<std::mutex> lock(allowlist_mutex_);
    if (user_allowlist_.count(host)) {
      ++stat_allowed_;
      return result;
    }
    // Parent-domain allowlisting: "example.com" covers "sub.example.com"
    std::string parent = host;
    size_t dot = parent.find('.');
    while (dot != std::string::npos) {
      parent = parent.substr(dot + 1);
      if (user_allowlist_.count(parent)) {
        ++stat_allowed_;
        return result;
      }
      dot = parent.find('.');
    }
  }

  // ── Step 2: User blocklist ───────────────────────────────────────────────
  {
    std::lock_guard<std::mutex> lock(blocklist_mutex_);
    if (user_blocklist_.count(host)) {
      result.decision = Decision::BLOCK;
      result.reason = BlockReason::USER_BLOCKED;
      ++stat_blocked_;
      return result;
    }
  }

  // ── Step 3: CNAME cloaking (static map) ─────────────────────────────────
  CnameResolution cname = cname_resolver_->CheckStatic(host);
  if (cname.is_cloaked) {
    result.decision = Decision::BLOCK;
    result.reason = BlockReason::CNAME_CLOAKING;
    result.matched_domain = cname.cloaking_domain;
    result.is_cname_cloaked = true;
    ++stat_blocked_;
    ++stat_cname_blocked_;
    return result;
  }

  // ── Step 4: Static blocklist (Bloom filter + hash map) ───────────────────
  const DomainMatcher* matcher = blocklist_manager_->GetMatcher();
  if (matcher && matcher->IsBlocked(host)) {
    result.decision = Decision::BLOCK;
    result.reason = BlockReason::BLOCKLIST;
    ++stat_blocked_;
    return result;
  }

  // ── Step 5: Strip tracking params ───────────────────────────────────────
  AnalysisResult analysis = url_analyzer_->Analyze(context.url);
  if (analysis.was_modified) {
    result.decision = Decision::MODIFY;
    result.modified_url = analysis.cleaned_url;
    result.stripped_params = analysis.stripped_params;
    ++stat_modified_;
    return result;
  }

  ++stat_allowed_;
  return result;
}

// ── Allowlist management ─────────────────────────────────────────────────────

void RequestInterceptor::AllowDomain(const std::string& domain) {
  std::lock_guard<std::mutex> lock(allowlist_mutex_);
  user_allowlist_.insert(domain);
}

void RequestInterceptor::RemoveAllowedDomain(const std::string& domain) {
  std::lock_guard<std::mutex> lock(allowlist_mutex_);
  user_allowlist_.erase(domain);
}

bool RequestInterceptor::IsDomainAllowed(const std::string& domain) const {
  std::lock_guard<std::mutex> lock(allowlist_mutex_);
  return user_allowlist_.count(domain) > 0;
}

// ── User blocklist management ────────────────────────────────────────────────

void RequestInterceptor::BlockDomain(const std::string& domain) {
  std::lock_guard<std::mutex> lock(blocklist_mutex_);
  user_blocklist_.insert(domain);
}

void RequestInterceptor::RemoveBlockedDomain(const std::string& domain) {
  std::lock_guard<std::mutex> lock(blocklist_mutex_);
  user_blocklist_.erase(domain);
}

// ── Statistics ───────────────────────────────────────────────────────────────

RequestInterceptor::Stats RequestInterceptor::GetStats() const {
  Stats s;
  s.total_requests = stat_total_.load();
  s.blocked        = stat_blocked_.load();
  s.allowed        = stat_allowed_.load();
  s.modified       = stat_modified_.load();
  s.cname_blocked  = stat_cname_blocked_.load();
  return s;
}

void RequestInterceptor::ResetStats() {
  stat_total_.store(0);
  stat_blocked_.store(0);
  stat_allowed_.store(0);
  stat_modified_.store(0);
  stat_cname_blocked_.store(0);
}

// ── Private helpers ──────────────────────────────────────────────────────────

// static
std::string RequestInterceptor::ExtractHost(const std::string& url) {
  return ExtractHostFromUrl(url);
}

}  // namespace eagleeye
