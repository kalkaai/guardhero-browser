// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "eagleeye-native/blocker/url_analyzer.h"

#include <algorithm>
#include <sstream>

namespace eagleeye {

UrlAnalyzer::UrlAnalyzer() {
  InitDefaultParams();
}

UrlAnalyzer::~UrlAnalyzer() = default;

void UrlAnalyzer::InitDefaultParams() {
  // UTM parameters (universal campaign tracking)
  tracking_params_ = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_reader", "utm_name", "utm_pubreferrer", "utm_swu",
    // Google Ads
    "gclid", "gclsrc", "dclid", "_ga",
    // Facebook / Instagram
    "fbclid", "fb_action_ids", "fb_action_types", "fb_ref", "fb_source",
    "fb_share", "igshid",
    // Microsoft / Bing
    "msclkid",
    // Mailchimp
    "mc_eid", "mc_cid",
    // Yandex
    "yclid", "_openstat",
    // Twitter / X
    "twclid",
    // HubSpot
    "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp",
    // Adobe / Omniture
    "s_cid",
    // Marketo
    "mkt_tok",
    // Generic
    "ref", "affiliate_id", "click_id", "affiliate", "referral",
    "campaign_id", "ad_id", "adgroupid", "campaignid", "adid",
    // LinkedIn
    "li_fat_id", "li_source",
    // TikTok
    "ttclid",
  };
}

void UrlAnalyzer::AddTrackingParam(const std::string& param_name) {
  std::string lower = param_name;
  std::transform(lower.begin(), lower.end(), lower.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  tracking_params_.insert(lower);
}

// static
std::string UrlAnalyzer::UrlDecode(const std::string& str) {
  std::string result;
  result.reserve(str.size());
  for (size_t i = 0; i < str.size(); ++i) {
    if (str[i] == '%' && i + 2 < str.size()) {
      int hi = std::isxdigit(str[i+1]) ? (std::tolower(str[i+1]) >= 'a'
                   ? str[i+1] - 'a' + 10 : str[i+1] - '0') : -1;
      int lo = std::isxdigit(str[i+2]) ? (std::tolower(str[i+2]) >= 'a'
                   ? str[i+2] - 'a' + 10 : str[i+2] - '0') : -1;
      if (hi >= 0 && lo >= 0) {
        result += static_cast<char>(hi * 16 + lo);
        i += 2;
        continue;
      }
    } else if (str[i] == '+') {
      result += ' ';
      continue;
    }
    result += str[i];
  }
  return result;
}

// static
std::vector<std::pair<std::string, std::string>>
UrlAnalyzer::ParseQueryString(const std::string& query) {
  std::vector<std::pair<std::string, std::string>> params;
  std::istringstream stream(query);
  std::string token;
  while (std::getline(stream, token, '&')) {
    if (token.empty()) continue;
    size_t eq = token.find('=');
    if (eq == std::string::npos) {
      params.emplace_back(token, "");
    } else {
      params.emplace_back(token.substr(0, eq), token.substr(eq + 1));
    }
  }
  return params;
}

// static
std::string UrlAnalyzer::BuildQueryString(
    const std::vector<std::pair<std::string, std::string>>& params) {
  std::string result;
  for (const auto& [key, value] : params) {
    if (!result.empty()) result += '&';
    result += key;
    if (!value.empty()) {
      result += '=';
      result += value;
    }
  }
  return result;
}

bool UrlAnalyzer::HasTrackingParams(const std::string& url) const {
  size_t query_start = url.find('?');
  if (query_start == std::string::npos) return false;

  std::string query = url.substr(query_start + 1);
  // Strip fragment if present
  size_t frag = query.find('#');
  if (frag != std::string::npos) query = query.substr(0, frag);

  auto params = ParseQueryString(query);
  for (const auto& [key, value] : params) {
    std::string lower_key = key;
    std::transform(lower_key.begin(), lower_key.end(), lower_key.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    if (tracking_params_.count(lower_key)) {
      return true;
    }
  }
  return false;
}

AnalysisResult UrlAnalyzer::Analyze(const std::string& url) const {
  AnalysisResult result;
  result.was_modified = false;

  size_t query_start = url.find('?');
  if (query_start == std::string::npos) {
    result.cleaned_url = url;
    return result;
  }

  std::string base = url.substr(0, query_start);
  std::string query_and_fragment = url.substr(query_start + 1);

  // Split fragment
  std::string query = query_and_fragment;
  std::string fragment;
  size_t frag_pos = query_and_fragment.find('#');
  if (frag_pos != std::string::npos) {
    query = query_and_fragment.substr(0, frag_pos);
    fragment = query_and_fragment.substr(frag_pos);
  }

  auto params = ParseQueryString(query);
  std::vector<std::pair<std::string, std::string>> kept_params;

  for (const auto& [key, value] : params) {
    std::string lower_key = key;
    std::transform(lower_key.begin(), lower_key.end(), lower_key.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    if (tracking_params_.count(lower_key)) {
      result.stripped_params.push_back(key + "=" + value);
      result.was_modified = true;
    } else {
      kept_params.emplace_back(key, value);
    }
  }

  if (result.was_modified) {
    result.cleaned_url = base;
    if (!kept_params.empty()) {
      result.cleaned_url += '?';
      result.cleaned_url += BuildQueryString(kept_params);
    }
    result.cleaned_url += fragment;
  } else {
    result.cleaned_url = url;
  }

  return result;
}

std::string UrlAnalyzer::StripTrackingParams(const std::string& url) const {
  return Analyze(url).cleaned_url;
}

}  // namespace eagleeye
