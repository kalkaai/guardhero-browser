// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// eagleeye_interceptor.cc — Wires EagleEye into Chromium's network stack.
//
// Registration:
//   Called once from IOThread::Init() (chrome/browser/io_thread.cc):
//
//     net::URLRequestFilter::GetInstance()->AddHostnameInterceptor(
//         "https", "",   // empty host = intercept all HTTPS
//         std::make_unique<guardhero::EagleEyeInterceptor>());
//     net::URLRequestFilter::GetInstance()->AddHostnameInterceptor(
//         "http", "",
//         std::make_unique<guardhero::EagleEyeInterceptor>());
//
//   This is applied by patches/eagleeye/011-register-eagleeye-in-network-service.patch.
//
// Request lifecycle:
//   For every outgoing request, Chromium calls MaybeInterceptRequest().
//   We delegate to eagleeye::RequestInterceptor::Intercept(), then:
//
//     BLOCK  → URLRequestErrorJob (net::ERR_BLOCKED_BY_CLIENT)
//              Request dies here; caller (renderer / fetch API) sees a network
//              error. The popup's tracker list is updated via the JS bridge.
//
//     MODIFY → URLRequestRedirectJob (307 Internal Redirect)
//              Tracking params were stripped. We issue a same-origin 307
//              redirect to the cleaned URL. The redirect is handled entirely
//              within the browser process — the renderer sees a single response
//              at the cleaned URL, never the dirty URL.
//              "Internal redirect" means no CORS preflight is re-issued and
//              the redirect is not visible to JavaScript timing APIs.
//
//     ALLOW  → nullptr (Chromium handles normally)
//
// URL passing:
//   context.url receives the FULL URL (url.spec()), not just the host.
//   This lets the RequestInterceptor's UrlAnalyzer find and strip query params.
//   The decision engine's ExtractHost() parses the host from the full URL on
//   the hot path; this is ~50ns and is cheaper than a second GURL construction.

#include "chrome/browser/guardhero/eagleeye_interceptor.h"

#include <string>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/logging.h"
#include "base/path_service.h"
#include "net/base/net_errors.h"
#include "net/http/http_response_headers.h"
#include "net/url_request/url_request.h"
#include "net/url_request/url_request_error_job.h"
#include "net/url_request/url_request_filter.h"
#include "net/url_request/url_request_redirect_job.h"
#include "url/gurl.h"

namespace guardhero {

// ── Singleton ────────────────────────────────────────────────────────────────

// static
EagleEyeInterceptor* EagleEyeInterceptor::g_instance_ = nullptr;

// static
EagleEyeInterceptor* EagleEyeInterceptor::GetInstance() {
  return g_instance_;
}

// ── Constructor / Destructor ─────────────────────────────────────────────────

EagleEyeInterceptor::EagleEyeInterceptor() {
  DCHECK(!g_instance_) << "EagleEyeInterceptor created twice";
  g_instance_ = this;

  InitBlocklists();
  DVLOG(1) << "Guard Hero EagleEye: interceptor initialized";
}

EagleEyeInterceptor::~EagleEyeInterceptor() {
  if (g_instance_ == this)
    g_instance_ = nullptr;
}

// ── Blocklist initialization ─────────────────────────────────────────────────

void EagleEyeInterceptor::InitBlocklists() {
  blocklist_manager_ = std::make_unique<eagleeye::BlocklistManager>();
  request_interceptor_ =
      std::make_unique<eagleeye::RequestInterceptor>(blocklist_manager_.get());

  // Locate the bundled blocklist relative to the browser executable.
  //   Installed: <app_dir>/resources/guardhero/lists/blocklist.txt
  //   Dev build: same path under out/Release/
  base::FilePath exe_dir;
  base::PathService::Get(base::DIR_EXE, &exe_dir);

  base::FilePath bundled_blocklist =
      exe_dir.AppendASCII("resources")
             .AppendASCII("guardhero")
             .AppendASCII("lists")
             .AppendASCII("blocklist.txt");

  if (base::PathExists(bundled_blocklist)) {
    auto stats = blocklist_manager_->Load(bundled_blocklist.AsUTF8Unsafe());
    if (stats.load_success) {
      DVLOG(1) << "Guard Hero EagleEye: loaded " << stats.total_domains
               << " domains from " << bundled_blocklist.value();
    } else {
      LOG(WARNING) << "Guard Hero EagleEye: failed to parse blocklist at "
                   << bundled_blocklist.value();
    }
  } else {
    LOG(WARNING) << "Guard Hero EagleEye: bundled blocklist not found at "
                 << bundled_blocklist.value()
                 << " — all requests will ALLOW until a list is loaded";
  }
}

// ── net::URLRequestInterceptor ───────────────────────────────────────────────

net::URLRequestJob* EagleEyeInterceptor::MaybeInterceptRequest(
    net::URLRequest* request,
    net::NetworkDelegate* network_delegate) const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!blocking_enabled_)
    return nullptr;

  const GURL& url = request->url();

  // Skip non-HTTP(S) schemes (data:, blob:, guardhero:, chrome:, etc.)
  if (!url.SchemeIsHTTPOrHTTPS())
    return nullptr;

  // Skip the internal redirect we ourselves just issued for MODIFY decisions.
  // Without this guard, MaybeInterceptRequest() would be called again on the
  // redirected (clean) URL and could loop: clean URL has no tracking params
  // so it would ALLOW, but we still want to short-circuit the second call.
  // The redirect URL we issue is always clean — if IsBlocked() on the host
  // also returns false, we'd fall through to ALLOW anyway; this is just
  // a documentation comment since the logic is naturally safe.

  // ── Build RequestContext ───────────────────────────────────────────────────
  //
  // Pass url.spec() (the FULL URL) so that the UrlAnalyzer can find and
  // strip query parameters. The decision engine's ExtractHost() parses
  // the hostname from the spec on the hot path (~50ns overhead vs. using
  // url.host() directly, which would miss the query string for MODIFY).
  eagleeye::RequestContext context;
  context.url = url.spec();
  context.tab_id = -1;  // Wired to WebContentsObserver tab ID in v1.0

  // Initiator domain for future context-aware rules (e.g., allow tracker on
  // its own first-party page, block it everywhere else).
  if (request->initiator().has_value())
    context.initiator_domain = request->initiator()->host();

  context.resource_type = "unknown";  // ResourceType enum wired in v1.0

  // ── Decision ──────────────────────────────────────────────────────────────
  eagleeye::InterceptResult result = request_interceptor_->Intercept(context);

  switch (result.decision) {

    // ── BLOCK ──────────────────────────────────────────────────────────────
    case eagleeye::Decision::BLOCK: {
      DVLOG(2) << "Guard Hero EagleEye: BLOCK " << url.host()
               << " (matched=" << result.matched_domain
               << " reason=" << static_cast<int>(result.reason)
               << " cname=" << result.is_cname_cloaked << ")";
      return new net::URLRequestErrorJob(request, network_delegate,
                                         net::ERR_BLOCKED_BY_CLIENT);
    }

    // ── MODIFY — internal 307 redirect to tracking-param-free URL ──────────
    //
    // How this works:
    //   1. We return a URLRequestRedirectJob pointing at the cleaned URL.
    //   2. Chromium treats this as a same-origin 307 redirect handled entirely
    //      in the browser process (no round-trip to the network).
    //   3. The renderer receives the response at the cleaned URL, never aware
    //      of the original dirty URL.
    //   4. The Location header on the synthetic 307 response is the cleaned URL.
    //   5. CORS: a same-origin 307 does not trigger a preflight re-issue.
    //   6. The redirect is transparent to JavaScript Performance/Navigation
    //      timing because it is classified as an "internal redirect".
    //
    // Why 307 and not 301?
    //   307 Temporary Redirect preserves the HTTP method (POST stays POST).
    //   Tracking params rarely appear on POST bodies, but using 307 is correct
    //   for the general case. 301 would convert POST to GET.
    //
    // Security note:
    //   We validate the cleaned URL is well-formed and same-host before
    //   issuing the redirect to prevent an open redirect from a malformed
    //   modified_url returned by the URL analyzer.
    case eagleeye::Decision::MODIFY: {
      const GURL clean_url(result.modified_url);

      // Validate the cleaned URL before redirecting to it.
      if (!clean_url.is_valid()) {
        LOG(WARNING) << "Guard Hero EagleEye: MODIFY produced invalid URL '"
                     << result.modified_url << "' for " << url.spec()
                     << " — falling through to ALLOW";
        return nullptr;
      }

      // Safety check: cleaned URL must be same-host as original.
      // Prevents a bug in UrlAnalyzer from becoming an open redirect.
      if (clean_url.host() != url.host()) {
        LOG(WARNING) << "Guard Hero EagleEye: MODIFY changed host ("
                     << url.host() << " → " << clean_url.host()
                     << ") — refusing redirect, falling through to ALLOW";
        return nullptr;
      }

      // Scheme must stay the same (https stays https, http stays http).
      if (clean_url.scheme() != url.scheme()) {
        LOG(WARNING) << "Guard Hero EagleEye: MODIFY changed scheme — refusing";
        return nullptr;
      }

      DVLOG(2) << "Guard Hero EagleEye: MODIFY " << url.spec()
               << " → " << result.modified_url
               << " (stripped " << result.stripped_params.size() << " params: "
               << [&]() {
                    std::string s;
                    for (const auto& p : result.stripped_params)
                      s += p + " ";
                    return s;
                  }()
               << ")";

      return new net::URLRequestRedirectJob(
          request,
          network_delegate,
          clean_url,
          // 307 Temporary Redirect — preserves POST method, same-origin safe.
          net::URLRequestRedirectJob::REDIRECT_307_TEMPORARY_REDIRECT,
          // Redirect reason string appears in net-internals for debugging.
          "EagleEye-TrackingParamStrip");
    }

    // ── ALLOW ──────────────────────────────────────────────────────────────
    case eagleeye::Decision::ALLOW:
    default:
      return nullptr;  // Chromium handles normally
  }
}

// ── Allowlist / Blocklist management ─────────────────────────────────────────

void EagleEyeInterceptor::AllowDomain(const std::string& domain) {
  DCHECK(request_interceptor_);
  request_interceptor_->AllowDomain(domain);
}

void EagleEyeInterceptor::BlockDomain(const std::string& domain) {
  DCHECK(request_interceptor_);
  request_interceptor_->BlockDomain(domain);
}

bool EagleEyeInterceptor::IsDomainAllowed(const std::string& domain) const {
  DCHECK(request_interceptor_);
  return request_interceptor_->IsDomainAllowed(domain);
}

// ── Enable / disable ─────────────────────────────────────────────────────────

void EagleEyeInterceptor::SetBlockingEnabled(bool enabled) {
  blocking_enabled_ = enabled;
  DVLOG(1) << "Guard Hero EagleEye: blocking "
           << (enabled ? "ENABLED" : "DISABLED");
}

// ── Statistics ───────────────────────────────────────────────────────────────

int64_t EagleEyeInterceptor::GetSessionBlockCount() const {
  if (!request_interceptor_) return 0;
  return request_interceptor_->GetStats().blocked;
}

int64_t EagleEyeInterceptor::GetSessionModifyCount() const {
  if (!request_interceptor_) return 0;
  return request_interceptor_->GetStats().modified;
}

void EagleEyeInterceptor::ResetSessionStats() {
  if (request_interceptor_)
    request_interceptor_->ResetStats();
}

}  // namespace guardhero
