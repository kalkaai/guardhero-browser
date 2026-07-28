// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// header_modifier.h — Applies user-defined header modification rules to
// outgoing requests and incoming responses via Chromium's WebRequestAPI.
//
// Rules are authored in the DevMode Header Editor UI and stored as JSON in
// chrome.storage.local.  The JS layer calls chrome.guardhero.setHeaderRules([])
// to push updated rules down to this native component.
//
// Rule JSON schema:
//   {
//     "id":          string,
//     "enabled":     boolean,
//     "urlPattern":  string,        // glob or /regex/
//     "headerType":  "request" | "response",
//     "headerName":  string,
//     "operation":   "add" | "modify" | "remove",
//     "value":       string,        // ignored for "remove"
//     "scope":       "tab" | "all" | "domain"
//   }

#ifndef CHROME_BROWSER_GUARDHERO_HEADER_MODIFIER_H_
#define CHROME_BROWSER_GUARDHERO_HEADER_MODIFIER_H_

#include <map>
#include <memory>
#include <string>
#include <vector>

#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/values.h"
#include "extensions/browser/api/web_request/web_request_info.h"
#include "net/http/http_request_headers.h"
#include "net/http/http_response_headers.h"

namespace guardhero {

// Scope of a header rule.
enum class HeaderRuleScope {
  kCurrentTab,     // Apply only to the tab that set the rule
  kAllTabs,        // Apply to every tab in the browser
  kSpecificDomain, // Apply to a specific domain (derived from urlPattern)
};

// Operation performed on the header.
enum class HeaderOperation {
  kAdd,    // Add header (even if it already exists)
  kModify, // Set header (add if missing, replace if present)
  kRemove, // Delete header
};

// A single header modification rule.
struct HeaderRule {
  std::string id;
  bool enabled = true;
  std::string url_pattern;       // glob ("*.example.com/*") or /regex/
  bool is_request = true;        // true = request headers; false = response
  std::string header_name;
  HeaderOperation operation = HeaderOperation::kModify;
  std::string value;             // empty for kRemove
  HeaderRuleScope scope = HeaderRuleScope::kAllTabs;
  int scoped_tab_id = -1;        // used when scope == kCurrentTab
};

// HeaderModifier — singleton owned by the browser process.
//
// Registration:
//   Called from chrome/browser/guardhero/header_modifier_factory.cc during
//   ProfileKeyedServiceFactory setup.  The modifier hooks into
//   WebRequestEventRouter via chrome::OnBeforeSendHeaders and
//   chrome::OnHeadersReceived extension points.
class HeaderModifier {
 public:
  HeaderModifier();
  ~HeaderModifier();

  // Replace the full rule set.  Called from the JS bridge when the user
  // saves rules in the Header Editor UI.
  // |rules_json| is a JSON array matching the rule schema above.
  bool SetRules(const std::string& rules_json);

  // Returns the current rule set as a JSON array string.
  std::string GetRulesJson() const;

  // ── WebRequestAPI hooks ───────────────────────────────────────────────────
  // Called by chrome::OnBeforeSendHeaders for every outgoing request.
  // Applies matching request-header rules in-place.
  void ApplyRequestRules(const GURL& url,
                         int tab_id,
                         net::HttpRequestHeaders* headers);

  // Called by chrome::OnHeadersReceived for every incoming response.
  // Applies matching response-header rules in-place.
  void ApplyResponseRules(const GURL& url,
                          int tab_id,
                          scoped_refptr<net::HttpResponseHeaders>* headers);

  // Returns the number of active (enabled) rules.
  size_t ActiveRuleCount() const;

  // Singleton accessor.
  static HeaderModifier* GetInstance();

 private:
  // Parse a base::Value::List of rule dicts into HeaderRule structs.
  static std::vector<HeaderRule> ParseRules(const base::Value::List& list);

  // Returns true if |url| matches the glob or regex pattern in |rule|.
  static bool UrlMatchesRule(const GURL& url, const HeaderRule& rule);

  // Applies a single rule to a header map.
  static void ApplyRule(const HeaderRule& rule,
                        net::HttpRequestHeaders* headers);

  std::vector<HeaderRule> rules_;
  std::string rules_json_cache_;

  static HeaderModifier* g_instance_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<HeaderModifier> weak_factory_{this};

  HeaderModifier(const HeaderModifier&) = delete;
  HeaderModifier& operator=(const HeaderModifier&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_HEADER_MODIFIER_H_
