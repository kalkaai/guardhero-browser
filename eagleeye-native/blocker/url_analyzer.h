// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// url_analyzer.h — Strip tracking query parameters from URLs.

#ifndef EAGLEEYE_NATIVE_BLOCKER_URL_ANALYZER_H_
#define EAGLEEYE_NATIVE_BLOCKER_URL_ANALYZER_H_

#include <set>
#include <string>
#include <vector>

namespace eagleeye {

// UrlAnalyzer — Strips known tracking query parameters from URLs.
//
// Tracking params stripped by default:
//   UTM: utm_source, utm_medium, utm_campaign, utm_term, utm_content
//   Google: gclid, gclsrc, dclid
//   Facebook: fbclid, fb_action_ids, fb_action_types, fb_ref, fb_source
//   Microsoft: msclkid
//   Mailchimp: mc_eid
//   Instagram: igshid
//   General: ref, affiliate_id, click_id, session_id (when standalone)
//
// The cleaned URL is returned. If no tracking params are found, returns
// the original URL unchanged (no copy allocation).

struct AnalysisResult {
  std::string cleaned_url;        // URL with tracking params removed
  std::vector<std::string> stripped_params;  // List of params that were removed
  bool was_modified;              // True if URL was changed
};

class UrlAnalyzer {
 public:
  UrlAnalyzer();
  ~UrlAnalyzer();

  // Analyze a URL and return the cleaned version plus metadata.
  AnalysisResult Analyze(const std::string& url) const;

  // Strip tracking params from URL. Returns cleaned URL string.
  // This is the fast path — no metadata overhead.
  std::string StripTrackingParams(const std::string& url) const;

  // Add a custom tracking param name to strip.
  void AddTrackingParam(const std::string& param_name);

  // Returns true if the URL contains any known tracking parameters.
  bool HasTrackingParams(const std::string& url) const;

  // Returns the set of tracking parameter names.
  const std::set<std::string>& GetTrackingParams() const {
    return tracking_params_;
  }

 private:
  std::set<std::string> tracking_params_;

  // Parse query string into key-value pairs
  static std::vector<std::pair<std::string, std::string>> ParseQueryString(
      const std::string& query);

  // Rebuild query string from pairs (omitting stripped params)
  static std::string BuildQueryString(
      const std::vector<std::pair<std::string, std::string>>& params);

  // URL-decode a string
  static std::string UrlDecode(const std::string& str);

  // Initialize the default tracking param set
  void InitDefaultParams();
};

}  // namespace eagleeye

#endif  // EAGLEEYE_NATIVE_BLOCKER_URL_ANALYZER_H_
