// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// request_event_broadcaster.h — Bridges EagleEye request decisions into the
// DevMode panel's JavaScript context via the chrome.guardhero.onRequestEvent
// API.
//
// Each network request that passes through EagleEyeInterceptor produces a
// RequestEvent.  The broadcaster serialises the event to JSON and dispatches
// it to all registered JS listeners in the DevMode WebUI frame via a
// chrome.guardhero.onRequestEvent message.
//
// Event schema (mirrors browser-ui/mocks/chrome-guardhero.ts RequestEvent):
//   {
//     url:           string,
//     type:          string,   // XHR | Script | Fetch | Image | Pixel | ...
//     decision:      "BLOCKED" | "ALLOWED" | "MODIFIED",
//     reason:        string,   // e.g. "EagleEye blocklist (Analytics)"
//     strippedParams: string[],
//     cnameChain:    string[],
//     tabId:         number,
//     timestamp:     number    // Unix ms
//   }

#ifndef CHROME_BROWSER_GUARDHERO_REQUEST_EVENT_BROADCASTER_H_
#define CHROME_BROWSER_GUARDHERO_REQUEST_EVENT_BROADCASTER_H_

#include <string>
#include <vector>

#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/values.h"

namespace guardhero {

// RequestEvent mirrors the JS-side RequestEvent interface.
struct RequestEvent {
  std::string url;
  std::string type;          // resource type string
  std::string decision;      // "BLOCKED" | "ALLOWED" | "MODIFIED"
  std::string reason;        // human-readable block/modify reason
  std::vector<std::string> stripped_params;
  std::vector<std::string> cname_chain;
  int tab_id = -1;
  int64_t timestamp_ms = 0;  // Unix epoch milliseconds
};

// RequestEventBroadcaster — owned by DevModePanel (one per browser window).
//
// Thread safety:
//   OnRequestEvent() is called from the IO thread (EagleEyeInterceptor).
//   Dispatch to JS listeners happens on the UI thread via PostTask.
class RequestEventBroadcaster {
 public:
  RequestEventBroadcaster();
  ~RequestEventBroadcaster();

  // Called by EagleEyeInterceptor (IO thread) for every intercepted request.
  // If the broadcaster is inactive (panel closed), events are silently dropped.
  void OnRequestEvent(const RequestEvent& event);

  // Activate / deactivate event collection.  Panel calls this on open/close.
  // Thread-safe.
  void SetActive(bool active);
  bool IsActive() const { return active_; }

  // Serialises a RequestEvent to a base::Value::Dict (for JSON dispatch).
  static base::Value::Dict SerialiseEvent(const RequestEvent& event);

  // Maximum number of events buffered in memory (FIFO ring, matches JS side).
  static constexpr size_t kMaxBufferedEvents = 500;

 private:
  // Dispatches a serialised event to the DevMode WebUI frame.
  // Must be called on the UI thread.
  void DispatchToWebUI(base::Value::Dict event_dict);

  // Ring buffer of recent events (populated even when panel is closed so the
  // panel can show history on open).
  std::vector<RequestEvent> event_buffer_;

  std::atomic<bool> active_{false};

  SEQUENCE_CHECKER(ui_sequence_checker_);
  base::WeakPtrFactory<RequestEventBroadcaster> weak_factory_{this};

  RequestEventBroadcaster(const RequestEventBroadcaster&) = delete;
  RequestEventBroadcaster& operator=(const RequestEventBroadcaster&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_REQUEST_EVENT_BROADCASTER_H_
