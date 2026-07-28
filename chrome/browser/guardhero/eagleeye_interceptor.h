// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// eagleeye_interceptor.h — Production URLRequestInterceptor wiring EagleEye
// native blocker into Chromium's network stack.

#ifndef CHROME_BROWSER_GUARDHERO_EAGLEEYE_INTERCEPTOR_H_
#define CHROME_BROWSER_GUARDHERO_EAGLEEYE_INTERCEPTOR_H_

#include <memory>
#include <string>

#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "net/url_request/url_request_interceptor.h"
#include "eagleeye-native/blocker/blocklist_manager.h"
#include "eagleeye-native/blocker/request_interceptor.h"

namespace net {
class URLRequest;
class NetworkDelegate;
class URLRequestJob;
}  // namespace net

namespace guardhero {

// EagleEyeInterceptor — registered in the network service to intercept all
// HTTP/HTTPS requests and apply the EagleEye blocking engine.
//
// Request lifecycle:
//   1. MaybeInterceptRequest() is called for every outgoing request.
//   2. Delegates to eagleeye::RequestInterceptor::Intercept().
//   3. On BLOCK: returns a URLRequestErrorJob (net::ERR_BLOCKED_BY_CLIENT).
//   4. On MODIFY: rewrites the URL (tracking params stripped).
//   5. On ALLOW: returns nullptr (Chromium handles normally).
//
// Registration: chrome/browser/io_thread.cc → IOThread::Init()
//
// Statistics are exposed to the JS bridge via GuardHeroApiHandler.
class EagleEyeInterceptor : public net::URLRequestInterceptor {
 public:
  EagleEyeInterceptor();
  ~EagleEyeInterceptor() override;

  // net::URLRequestInterceptor implementation
  net::URLRequestJob* MaybeInterceptRequest(
      net::URLRequest* request,
      net::NetworkDelegate* network_delegate) const override;

  // ── Allowlist / Blocklist management (called from JS bridge) ─────────────
  void AllowDomain(const std::string& domain);
  void BlockDomain(const std::string& domain);
  bool IsDomainAllowed(const std::string& domain) const;

  // ── Enable / disable blocking ────────────────────────────────────────────
  void SetBlockingEnabled(bool enabled);
  bool IsBlockingEnabled() const { return blocking_enabled_; }

  // ── Statistics ────────────────────────────────────────────────────────────
  int64_t GetSessionBlockCount() const;
  int64_t GetSessionModifyCount() const;
  void ResetSessionStats();

  // Singleton — registered once per browser process during IOThread::Init().
  static EagleEyeInterceptor* GetInstance();

 private:
  // Initialize the blocklist manager and load bundled lists.
  void InitBlocklists();

  std::unique_ptr<eagleeye::BlocklistManager> blocklist_manager_;
  std::unique_ptr<eagleeye::RequestInterceptor> request_interceptor_;
  bool blocking_enabled_ = true;

  static EagleEyeInterceptor* g_instance_;

  SEQUENCE_CHECKER(sequence_checker_);
  EagleEyeInterceptor(const EagleEyeInterceptor&) = delete;
  EagleEyeInterceptor& operator=(const EagleEyeInterceptor&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_EAGLEEYE_INTERCEPTOR_H_
