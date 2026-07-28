// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/devmode_panel.h"

#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/strings/stringprintf.h"
#include "chrome/browser/guardhero/request_event_broadcaster.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/views/side_panel/side_panel_coordinator.h"
#include "chrome/browser/ui/views/side_panel/side_panel_registry.h"

// ── URL constant ────────────────────────────────────────────────────────────
// The DevMode panel is served from Chromium's WebUI infrastructure at the
// guardhero:// scheme (registered in guardhero_url_constants.cc).
static constexpr char kDevModePanelURL[] = "guardhero://devtools/";

// ── Per-browser map ─────────────────────────────────────────────────────────
// We keep a lightweight map from Browser* → DevModePanel* so that
// GetForBrowser() can retrieve the panel without injecting a UserData key.
// Entries are removed in the destructor.
namespace {

std::map<Browser*, guardhero::DevModePanel*>& GetPanelMap() {
  static base::NoDestructor<std::map<Browser*, guardhero::DevModePanel*>> map;
  return *map;
}

}  // namespace

namespace guardhero {

DevModePanel::DevModePanel(Browser* browser)
    : browser_(browser),
      broadcaster_(std::make_unique<RequestEventBroadcaster>()) {
  DCHECK(browser_);

  GetPanelMap()[browser_] = this;

  RegisterSidePanelEntry();
  RegisterKeyboardShortcut();

  LOG(INFO) << "Guard Hero: DevModePanel created for browser window";
}

DevModePanel::~DevModePanel() {
  GetPanelMap().erase(browser_);
}

// static
DevModePanel* DevModePanel::GetForBrowser(Browser* browser) {
  auto& map = GetPanelMap();
  auto it = map.find(browser);
  return (it != map.end()) ? it->second : nullptr;
}

// static
std::string DevModePanel::GetPanelURL() {
  return kDevModePanelURL;
}

void DevModePanel::RegisterSidePanelEntry() {
  // SidePanelRegistry is owned by the browser window and lives on the UI
  // thread.  We register a "guardhero-devmode" entry that the
  // SidePanelCoordinator can show/hide via Toggle().
  //
  // In the full Chromium build this would use:
  //   SidePanelRegistry::Get(browser_->tab_strip_model()->GetActiveWebContents())
  //       ->Register(std::make_unique<SidePanelEntry>(
  //           SidePanelEntry::Id::kGuardHeroDevMode,
  //           base::UTF8ToUTF16("DevMode"),
  //           ...CreateWebView(kDevModePanelURL)...));
  //
  // Stubbed here so the header dependency chain compiles without the full
  // views layer:
  VLOG(1) << "Guard Hero: Registering DevMode side panel entry at "
          << kDevModePanelURL;
}

void DevModePanel::RegisterKeyboardShortcut() {
  // Binds Ctrl+Shift+D in the browser window's accelerator table.
  //
  // Full implementation registers via:
  //   ui::AcceleratorManager / BrowserView::InitAcceleratorMap()
  //   command: IDC_GUARDHERO_TOGGLE_DEVMODE
  //
  // The patch patches/eagleeye/013-devmode-panel.patch wires this into
  // chrome/browser/ui/views/frame/browser_view.cc.
  shortcut_registered_ = true;
  VLOG(1) << "Guard Hero: Ctrl+Shift+D shortcut registered for DevMode panel";
}

void DevModePanel::Toggle() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (panel_open_) {
    Close();
  } else {
    Open();
  }
}

void DevModePanel::Open() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (panel_open_) {
    return;
  }

  panel_open_ = true;
  OnPanelVisibilityChanged(true);

  LOG(INFO) << "Guard Hero: DevMode panel opened";
}

void DevModePanel::Close() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  if (!panel_open_) {
    return;
  }

  panel_open_ = false;
  OnPanelVisibilityChanged(false);

  LOG(INFO) << "Guard Hero: DevMode panel closed";
}

void DevModePanel::OnPanelVisibilityChanged(bool visible) {
  if (visible) {
    for (auto& obs : observers_) {
      obs.OnDevModePanelOpened();
    }
    // Start buffering request events now that the panel is visible.
    broadcaster_->SetActive(true);
  } else {
    for (auto& obs : observers_) {
      obs.OnDevModePanelClosed();
    }
    broadcaster_->SetActive(false);
  }
}

void DevModePanel::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void DevModePanel::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

}  // namespace guardhero
