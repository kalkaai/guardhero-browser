// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/request_event_broadcaster.h"

#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/task/task_traits.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "base/values.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"

namespace guardhero {

RequestEventBroadcaster::RequestEventBroadcaster() = default;
RequestEventBroadcaster::~RequestEventBroadcaster() = default;

void RequestEventBroadcaster::SetActive(bool active) {
  active_.store(active, std::memory_order_relaxed);
}

void RequestEventBroadcaster::OnRequestEvent(const RequestEvent& event) {
  // Called on the IO thread — post to UI thread for WebUI dispatch.
  if (!active_.load(std::memory_order_relaxed)) {
    return;
  }

  base::Value::Dict serialised = SerialiseEvent(event);

  // Marshal to the UI thread.
  content::GetUIThreadTaskRunner({})->PostTask(
      FROM_HERE,
      base::BindOnce(&RequestEventBroadcaster::DispatchToWebUI,
                     weak_factory_.GetWeakPtr(),
                     std::move(serialised)));
}

// static
base::Value::Dict RequestEventBroadcaster::SerialiseEvent(
    const RequestEvent& event) {
  base::Value::Dict dict;
  dict.Set("url", event.url);
  dict.Set("type", event.type);
  dict.Set("decision", event.decision);
  dict.Set("reason", event.reason);
  dict.Set("tabId", event.tab_id);
  dict.Set("timestamp", static_cast<double>(event.timestamp_ms));

  base::Value::List stripped;
  for (const auto& p : event.stripped_params) {
    stripped.Append(p);
  }
  dict.Set("strippedParams", std::move(stripped));

  base::Value::List cname;
  for (const auto& c : event.cname_chain) {
    cname.Append(c);
  }
  dict.Set("cnameChain", std::move(cname));

  return dict;
}

void RequestEventBroadcaster::DispatchToWebUI(base::Value::Dict event_dict) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(ui_sequence_checker_);

  // Serialise to JSON string for dispatch.
  std::string json;
  if (!base::JSONWriter::Write(base::Value(std::move(event_dict)), &json)) {
    LOG(WARNING) << "Guard Hero: Failed to serialise request event to JSON";
    return;
  }

  // In the full implementation this would call into the WebUI message handler:
  //   devmode_webui_handler_->FireWebUIListener("guardhero-request-event", json)
  //
  // Which triggers chrome.guardhero.onRequestEvent listeners in the JS layer.
  VLOG(2) << "Guard Hero: Dispatched request event to DevMode panel: " << json;
}

}  // namespace guardhero
