// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// audit_runner.h — Triggers an instrumented headless page load for a given URL,
// collects all request events via EagleEye, and returns a structured audit
// result for display in the Tracker Audit Report (browser-ui/audit/).
//
// Triggered by:
//   • guardhero://audit?url=<url>  (browser navigation)
//   • Right-click → "Generate Guard Hero Privacy Report"
//   • chrome.guardhero.runAudit(url) from the DevMode panel JS

#ifndef CHROME_BROWSER_GUARDHERO_AUDIT_RUNNER_H_
#define CHROME_BROWSER_GUARDHERO_AUDIT_RUNNER_H_

#include <map>
#include <memory>
#include <string>
#include <vector>

#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/time/time.h"
#include "chrome/browser/guardhero/request_event_broadcaster.h"
#include "url/gurl.h"

namespace content {
class BrowserContext;
}

namespace guardhero {

// Category of a detected tracker.
enum class TrackerCategory {
  kAnalytics,
  kAdvertising,
  kSocial,
  kFingerprinting,
  kCnameCloaked,
  kOther,
};

// Per-tracker information in an audit result.
struct TrackerResult {
  std::string domain;
  TrackerCategory category = TrackerCategory::kOther;
  int request_count = 0;
  int severity_score = 0;  // 0-100
  std::vector<std::string> sample_urls;
};

// Fingerprinting API exposure for a single audit.
struct FingerprintSurface {
  bool canvas_exposed = false;
  bool webgl_exposed = false;
  bool audio_context_exposed = false;
  bool font_enumeration_exposed = false;
  bool screen_resolution_exposed = false;
  bool battery_api_exposed = false;
  bool network_info_exposed = false;
  bool webrtc_exposed = false;
};

// Full audit result returned to the UI.
struct AuditResult {
  std::string audited_url;
  base::Time audit_time;

  int total_requests = 0;
  int blocked_requests = 0;
  int third_party_requests = 0;
  int64_t bytes_saved = 0;  // Estimated bytes not transferred due to blocking

  double third_party_percent = 0.0;

  std::map<TrackerCategory, std::vector<TrackerResult>> trackers_by_category;

  FingerprintSurface fingerprint_surface;

  // Serialises the result to a JSON string for delivery to the JS layer.
  std::string ToJson() const;
};

// Callback invoked when an audit completes (or fails).
using AuditCallback =
    base::OnceCallback<void(bool success, AuditResult result)>;

// AuditRunner — drives a headless instrumented page load.
//
// Each call to RunAudit() creates a headless WebContents, navigates to the
// target URL, collects all request events emitted by EagleEyeInterceptor,
// injects a JS snippet to probe fingerprinting API exposure, and then calls
// the callback with the aggregated AuditResult.
//
// Only one audit can run at a time per AuditRunner instance.
class AuditRunner {
 public:
  explicit AuditRunner(content::BrowserContext* browser_context);
  ~AuditRunner();

  // Start an audit for |url|.  Calls |callback| on the UI thread when done.
  // Returns false and calls callback(false, {}) immediately if an audit is
  // already in progress.
  bool RunAudit(const GURL& url, AuditCallback callback);

  // Cancels a running audit.
  void Cancel();

  bool IsRunning() const { return running_; }

  // Singleton per BrowserContext.
  static AuditRunner* GetForContext(content::BrowserContext* ctx);

 private:
  // Called when the headless page load completes (nav committed + idle).
  void OnPageLoadComplete();

  // Called for each request event captured during the audit.
  void OnRequestEvent(const RequestEvent& event);

  // Aggregates collected events into an AuditResult.
  AuditResult BuildResult() const;

  // Runs the fingerprinting probe JS in the loaded page and populates
  // |result.fingerprint_surface|.
  void ProbeFingerprintSurface(AuditResult* result);

  // Returns the TrackerCategory for a given domain by consulting the
  // EagleEye blocklist category metadata.
  static TrackerCategory CategoryForDomain(const std::string& domain);

  content::BrowserContext* browser_context_;
  GURL target_url_;

  std::vector<RequestEvent> captured_events_;
  AuditCallback pending_callback_;

  bool running_ = false;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<AuditRunner> weak_factory_{this};

  AuditRunner(const AuditRunner&) = delete;
  AuditRunner& operator=(const AuditRunner&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_AUDIT_RUNNER_H_
