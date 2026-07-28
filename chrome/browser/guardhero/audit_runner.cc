// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/audit_runner.h"

#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "base/values.h"
#include "chrome/browser/guardhero/eagleeye_interceptor.h"

namespace guardhero {

namespace {

// Approximate average response size for a blocked request (bytes).
// Used to estimate bytes saved.
constexpr int64_t kAverageTrackerRequestBytes = 8192;

// Maps domain suffixes to tracker categories.
// In production this would consult the blocklist's category metadata.
TrackerCategory GuessCategory(const std::string& domain) {
  static const std::vector<std::pair<std::string, TrackerCategory>> kHeuristics{
    {"google-analytics", TrackerCategory::kAnalytics},
    {"analytics",        TrackerCategory::kAnalytics},
    {"hotjar",           TrackerCategory::kAnalytics},
    {"mixpanel",         TrackerCategory::kAnalytics},
    {"segment",          TrackerCategory::kAnalytics},
    {"amplitude",        TrackerCategory::kAnalytics},
    {"doubleclick",      TrackerCategory::kAdvertising},
    {"googlesyndication",TrackerCategory::kAdvertising},
    {"adnxs",            TrackerCategory::kAdvertising},
    {"criteo",           TrackerCategory::kAdvertising},
    {"facebook",         TrackerCategory::kSocial},
    {"twitter",          TrackerCategory::kSocial},
    {"linkedin",         TrackerCategory::kSocial},
    {"canvas",           TrackerCategory::kFingerprinting},
    {"fingerprint",      TrackerCategory::kFingerprinting},
  };
  for (const auto& [substr, cat] : kHeuristics) {
    if (domain.find(substr) != std::string::npos) {
      return cat;
    }
  }
  return TrackerCategory::kOther;
}

static std::map<content::BrowserContext*, AuditRunner*>& GetRunnerMap() {
  static base::NoDestructor<
      std::map<content::BrowserContext*, AuditRunner*>> map;
  return *map;
}

std::string CategoryName(TrackerCategory cat) {
  switch (cat) {
    case TrackerCategory::kAnalytics:     return "Analytics";
    case TrackerCategory::kAdvertising:   return "Advertising";
    case TrackerCategory::kSocial:        return "Social";
    case TrackerCategory::kFingerprinting:return "Fingerprinting";
    case TrackerCategory::kCnameCloaked:  return "CNAME-cloaked";
    default:                              return "Other";
  }
}

}  // namespace

AuditRunner::AuditRunner(content::BrowserContext* browser_context)
    : browser_context_(browser_context) {
  GetRunnerMap()[browser_context_] = this;
}

AuditRunner::~AuditRunner() {
  GetRunnerMap().erase(browser_context_);
}

// static
AuditRunner* AuditRunner::GetForContext(content::BrowserContext* ctx) {
  auto& map = GetRunnerMap();
  auto it = map.find(ctx);
  return (it != map.end()) ? it->second : nullptr;
}

bool AuditRunner::RunAudit(const GURL& url, AuditCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (running_) {
    LOG(WARNING) << "Guard Hero AuditRunner: audit already in progress";
    std::move(callback).Run(false, AuditResult{});
    return false;
  }

  if (!url.is_valid() || !url.SchemeIsHTTPOrHTTPS()) {
    LOG(WARNING) << "Guard Hero AuditRunner: invalid URL: " << url.spec();
    std::move(callback).Run(false, AuditResult{});
    return false;
  }

  target_url_ = url;
  pending_callback_ = std::move(callback);
  captured_events_.clear();
  running_ = true;

  LOG(INFO) << "Guard Hero AuditRunner: starting audit of " << url.spec();

  // Full implementation:
  //   1. Create a headless WebContents via HeadlessWebContents::Builder.
  //   2. Install a RequestEventBroadcaster::Observer to capture events.
  //   3. Navigate to target_url_.
  //   4. Wait for DocumentIdle / network quiet (5s timeout).
  //   5. Call ProbeFingerprintSurface().
  //   6. OnPageLoadComplete() → BuildResult() → callback.
  //
  // For now we simulate a short async delay and synthesise a plausible result.
  content::GetUIThreadTaskRunner({})->PostDelayedTask(
      FROM_HERE,
      base::BindOnce(&AuditRunner::OnPageLoadComplete,
                     weak_factory_.GetWeakPtr()),
      base::Milliseconds(100));  // Immediate in tests; real impl awaits idle

  return true;
}

void AuditRunner::Cancel() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!running_) {
    return;
  }
  running_ = false;
  captured_events_.clear();

  if (pending_callback_) {
    std::move(pending_callback_).Run(false, AuditResult{});
  }
}

void AuditRunner::OnRequestEvent(const RequestEvent& event) {
  if (running_) {
    captured_events_.push_back(event);
  }
}

void AuditRunner::OnPageLoadComplete() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!running_) {
    return;
  }

  AuditResult result = BuildResult();
  ProbeFingerprintSurface(&result);

  running_ = false;

  LOG(INFO) << "Guard Hero AuditRunner: audit complete for "
            << target_url_.spec() << " — " << result.total_requests
            << " requests, " << result.blocked_requests << " blocked";

  if (pending_callback_) {
    std::move(pending_callback_).Run(true, std::move(result));
  }
}

AuditResult AuditRunner::BuildResult() const {
  AuditResult result;
  result.audited_url = target_url_.spec();
  result.audit_time = base::Time::Now();
  result.total_requests = static_cast<int>(captured_events_.size());

  int third_party_count = 0;
  std::map<std::string, TrackerResult> tracker_map;

  const std::string first_party_host = target_url_.host();

  for (const auto& event : captured_events_) {
    GURL event_url(event.url);
    const std::string host = event_url.host();

    if (event.decision == "BLOCKED") {
      result.blocked_requests++;
      result.bytes_saved += kAverageTrackerRequestBytes;

      TrackerCategory cat = CategoryForDomain(host);
      if (!event.cname_chain.empty()) {
        cat = TrackerCategory::kCnameCloaked;
      }

      auto& tr = tracker_map[host];
      tr.domain = host;
      tr.category = cat;
      tr.request_count++;
      tr.severity_score = std::min(100, tr.request_count * 10);
      if (tr.sample_urls.size() < 3) {
        tr.sample_urls.push_back(event.url);
      }
    }

    if (!host.empty() && host != first_party_host &&
        !base::EndsWith(host, "." + first_party_host,
                        base::CompareCase::INSENSITIVE_ASCII)) {
      third_party_count++;
    }
  }

  if (result.total_requests > 0) {
    result.third_party_percent =
        100.0 * third_party_count / result.total_requests;
  }
  result.third_party_requests = third_party_count;

  for (auto& [domain, tr] : tracker_map) {
    result.trackers_by_category[tr.category].push_back(std::move(tr));
  }

  return result;
}

void AuditRunner::ProbeFingerprintSurface(AuditResult* result) {
  // In the full implementation this executes a JS probe script in the
  // headless page's main world:
  //
  //   const probeScript = R"(
  //     ({
  //       canvas:       typeof CanvasRenderingContext2D !== 'undefined',
  //       webgl:        !!document.createElement('canvas').getContext('webgl'),
  //       audioContext: typeof AudioContext !== 'undefined',
  //       fonts:        typeof document.fonts !== 'undefined',
  //       screen:       typeof screen !== 'undefined',
  //       battery:      typeof navigator.getBattery !== 'undefined',
  //       networkInfo:  typeof navigator.connection !== 'undefined',
  //       webrtc:       typeof RTCPeerConnection !== 'undefined',
  //     })
  //   )";
  //
  // For now populate with conservative defaults indicating common APIs
  // are present (they are in standard Chromium).

  auto& fp = result->fingerprint_surface;
  fp.canvas_exposed = true;
  fp.webgl_exposed = true;
  fp.audio_context_exposed = true;
  fp.font_enumeration_exposed = false;  // Blocked by Guard Hero privacy patch
  fp.screen_resolution_exposed = true;
  fp.battery_api_exposed = false;       // Blocked by Guard Hero privacy patch
  fp.network_info_exposed = false;      // Blocked by Guard Hero privacy patch
  fp.webrtc_exposed = true;
}

// static
TrackerCategory AuditRunner::CategoryForDomain(const std::string& domain) {
  return GuessCategory(domain);
}

std::string AuditResult::ToJson() const {
  base::Value::Dict dict;
  dict.Set("url", audited_url);
  dict.Set("auditTime",
           audit_time.InMillisecondsFSinceUnixEpoch());
  dict.Set("totalRequests", total_requests);
  dict.Set("blockedRequests", blocked_requests);
  dict.Set("thirdPartyRequests", third_party_requests);
  dict.Set("thirdPartyPercent", third_party_percent);
  dict.Set("bytesSaved", static_cast<double>(bytes_saved));

  base::Value::Dict fp_dict;
  fp_dict.Set("canvas",       fingerprint_surface.canvas_exposed);
  fp_dict.Set("webgl",        fingerprint_surface.webgl_exposed);
  fp_dict.Set("audioContext", fingerprint_surface.audio_context_exposed);
  fp_dict.Set("fonts",        fingerprint_surface.font_enumeration_exposed);
  fp_dict.Set("screen",       fingerprint_surface.screen_resolution_exposed);
  fp_dict.Set("battery",      fingerprint_surface.battery_api_exposed);
  fp_dict.Set("networkInfo",  fingerprint_surface.network_info_exposed);
  fp_dict.Set("webrtc",       fingerprint_surface.webrtc_exposed);
  dict.Set("fingerprintSurface", std::move(fp_dict));

  base::Value::Dict by_cat;
  for (const auto& [cat, trackers] : trackers_by_category) {
    base::Value::List tracker_list;
    for (const auto& tr : trackers) {
      base::Value::Dict td;
      td.Set("domain",       tr.domain);
      td.Set("requestCount", tr.request_count);
      td.Set("severityScore",tr.severity_score);
      base::Value::List samples;
      for (const auto& u : tr.sample_urls) {
        samples.Append(u);
      }
      td.Set("sampleUrls", std::move(samples));
      tracker_list.Append(std::move(td));
    }

    // Use int value of enum as key (JS layer will re-map to strings).
    by_cat.Set(base::NumberToString(static_cast<int>(cat)),
               std::move(tracker_list));
  }
  dict.Set("trackersByCategory", std::move(by_cat));

  std::string json;
  base::JSONWriter::Write(base::Value(std::move(dict)), &json);
  return json;
}

}  // namespace guardhero
