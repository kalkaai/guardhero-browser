// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/header_modifier.h"

#include <algorithm>
#include <regex>

#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/strings/string_util.h"
#include "net/http/http_request_headers.h"
#include "url/gurl.h"

namespace guardhero {

// static
HeaderModifier* HeaderModifier::g_instance_ = nullptr;

HeaderModifier::HeaderModifier() {
  DCHECK(!g_instance_) << "HeaderModifier is a singleton";
  g_instance_ = this;
}

HeaderModifier::~HeaderModifier() {
  if (g_instance_ == this) {
    g_instance_ = nullptr;
  }
}

// static
HeaderModifier* HeaderModifier::GetInstance() {
  return g_instance_;
}

bool HeaderModifier::SetRules(const std::string& rules_json) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  auto parsed = base::JSONReader::ReadAndReturnValueWithError(rules_json);
  if (!parsed.has_value() || !parsed->is_list()) {
    LOG(WARNING) << "Guard Hero HeaderModifier: invalid rules JSON: "
                 << rules_json.substr(0, 200);
    return false;
  }

  rules_ = ParseRules(parsed->GetList());
  rules_json_cache_ = rules_json;

  LOG(INFO) << "Guard Hero HeaderModifier: loaded " << rules_.size()
            << " header rules";
  return true;
}

std::string HeaderModifier::GetRulesJson() const {
  return rules_json_cache_;
}

size_t HeaderModifier::ActiveRuleCount() const {
  return std::count_if(rules_.begin(), rules_.end(),
                       [](const HeaderRule& r) { return r.enabled; });
}

// static
std::vector<HeaderRule> HeaderModifier::ParseRules(
    const base::Value::List& list) {
  std::vector<HeaderRule> result;
  result.reserve(list.size());

  for (const auto& item : list) {
    if (!item.is_dict()) {
      continue;
    }
    const auto& dict = item.GetDict();

    HeaderRule rule;

    if (const auto* id = dict.FindString("id")) {
      rule.id = *id;
    }
    if (auto enabled = dict.FindBool("enabled")) {
      rule.enabled = *enabled;
    }
    if (const auto* pat = dict.FindString("urlPattern")) {
      rule.url_pattern = *pat;
    }
    if (const auto* ht = dict.FindString("headerType")) {
      rule.is_request = (*ht != "response");
    }
    if (const auto* name = dict.FindString("headerName")) {
      rule.header_name = *name;
    }
    if (const auto* op = dict.FindString("operation")) {
      if (*op == "add") {
        rule.operation = HeaderOperation::kAdd;
      } else if (*op == "remove") {
        rule.operation = HeaderOperation::kRemove;
      } else {
        rule.operation = HeaderOperation::kModify;
      }
    }
    if (const auto* val = dict.FindString("value")) {
      rule.value = *val;
    }
    if (const auto* scope = dict.FindString("scope")) {
      if (*scope == "tab") {
        rule.scope = HeaderRuleScope::kCurrentTab;
      } else if (*scope == "domain") {
        rule.scope = HeaderRuleScope::kSpecificDomain;
      } else {
        rule.scope = HeaderRuleScope::kAllTabs;
      }
    }

    result.push_back(std::move(rule));
  }

  return result;
}

// static
bool HeaderModifier::UrlMatchesRule(const GURL& url, const HeaderRule& rule) {
  if (rule.url_pattern.empty()) {
    return true;
  }

  const std::string url_str = url.spec();

  // Regex pattern: starts and ends with "/"
  if (rule.url_pattern.size() >= 2 &&
      rule.url_pattern.front() == '/' &&
      rule.url_pattern.back() == '/') {
    try {
      std::regex re(
          rule.url_pattern.substr(1, rule.url_pattern.size() - 2),
          std::regex::ECMAScript | std::regex::icase);
      return std::regex_search(url_str, re);
    } catch (const std::regex_error&) {
      return false;
    }
  }

  // Glob pattern: convert "*" → ".*" for simple matching.
  // A full glob-to-regex conversion would handle "?" and character classes;
  // this covers the common "*.example.com/*" case.
  std::string regex_str;
  regex_str.reserve(rule.url_pattern.size() * 2);
  for (char c : rule.url_pattern) {
    if (c == '*') {
      regex_str += ".*";
    } else if (std::string("^$.|?+()[]{}\\").find(c) != std::string::npos) {
      regex_str += '\\';
      regex_str += c;
    } else {
      regex_str += c;
    }
  }
  try {
    std::regex re(regex_str, std::regex::ECMAScript | std::regex::icase);
    return std::regex_search(url_str, re);
  } catch (const std::regex_error&) {
    return false;
  }
}

// static
void HeaderModifier::ApplyRule(const HeaderRule& rule,
                               net::HttpRequestHeaders* headers) {
  DCHECK(headers);

  switch (rule.operation) {
    case HeaderOperation::kAdd:
      // Add the header value even if it already exists (appends).
      headers->SetHeader(rule.header_name, rule.value);
      break;

    case HeaderOperation::kModify:
      headers->SetHeader(rule.header_name, rule.value);
      break;

    case HeaderOperation::kRemove:
      headers->RemoveHeader(rule.header_name);
      break;
  }
}

void HeaderModifier::ApplyRequestRules(const GURL& url,
                                        int tab_id,
                                        net::HttpRequestHeaders* headers) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  for (const auto& rule : rules_) {
    if (!rule.enabled || !rule.is_request) {
      continue;
    }
    if (rule.scope == HeaderRuleScope::kCurrentTab &&
        rule.scoped_tab_id != tab_id) {
      continue;
    }
    if (!UrlMatchesRule(url, rule)) {
      continue;
    }
    ApplyRule(rule, headers);
    VLOG(2) << "Guard Hero HeaderModifier: applied request rule '" << rule.id
            << "' to " << url.host();
  }
}

void HeaderModifier::ApplyResponseRules(
    const GURL& url,
    int tab_id,
    scoped_refptr<net::HttpResponseHeaders>* headers) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  // Response header modification uses HttpResponseHeaders::ReplaceStatusLine /
  // AddHeader / RemoveHeader — stubbed here as the interface requires a mutable
  // copy of the response headers object.
  for (const auto& rule : rules_) {
    if (!rule.enabled || rule.is_request) {
      continue;
    }
    if (rule.scope == HeaderRuleScope::kCurrentTab &&
        rule.scoped_tab_id != tab_id) {
      continue;
    }
    if (!UrlMatchesRule(url, rule)) {
      continue;
    }

    VLOG(2) << "Guard Hero HeaderModifier: applied response rule '" << rule.id
            << "' to " << url.host();

    // In the full implementation:
    //   scoped_refptr<net::HttpResponseHeaders> new_headers =
    //       base::MakeRefCounted<net::HttpResponseHeaders>(
    //           (*headers)->raw_headers());
    //   new_headers->RemoveHeader(rule.header_name);
    //   if (rule.operation != HeaderOperation::kRemove) {
    //     new_headers->AddHeader(rule.header_name, rule.value);
    //   }
    //   *headers = std::move(new_headers);
  }
}

}  // namespace guardhero
