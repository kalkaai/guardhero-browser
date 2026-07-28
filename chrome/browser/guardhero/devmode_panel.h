// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// devmode_panel.h — DevMode side panel lifecycle manager.
//
// Manages registration of the Guard Hero DevMode side panel with Chromium's
// SidePanelRegistry, the Ctrl+Shift+D keyboard shortcut, per-window open/close
// state, and the communication channel to the browser-ui devtools via the
// chrome.guardhero.onRequestEvent JS API.

#ifndef CHROME_BROWSER_GUARDHERO_DEVMODE_PANEL_H_
#define CHROME_BROWSER_GUARDHERO_DEVMODE_PANEL_H_

#include <memory>
#include <string>

#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/observer_list.h"
#include "base/sequence_checker.h"
#include "chrome/browser/ui/browser.h"

namespace content {
class WebContents;
}  // namespace content

namespace guardhero {

class RequestEventBroadcaster;

// DevModePanel — one instance per browser window.
//
// Lifecycle:
//   1. Created by DevModePanelFactory when a new browser window opens.
//   2. Registers itself with the window's SidePanelRegistry under the
//      "guardhero-devmode" entry ID.
//   3. Binds the Ctrl+Shift+D accelerator via the browser's
//      AcceleratorTable.
//   4. On toggle: calls SidePanelCoordinator::Toggle("guardhero-devmode").
//   5. Destroyed when the browser window closes.
class DevModePanel {
 public:
  // Observer interface — consumed by DevTools WebUI to track panel visibility.
  class Observer {
   public:
    virtual void OnDevModePanelOpened() {}
    virtual void OnDevModePanelClosed() {}
   protected:
    virtual ~Observer() = default;
  };

  explicit DevModePanel(Browser* browser);
  ~DevModePanel();

  // Called by the keyboard shortcut handler (Ctrl+Shift+D).
  void Toggle();

  // Programmatic open/close.
  void Open();
  void Close();

  bool IsOpen() const { return panel_open_; }

  // Returns the URL served inside the side panel WebView.
  // Resolves to guardhero://devtools/index.html
  static std::string GetPanelURL();

  // ── Observer management ──────────────────────────────────────────────────
  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

  // ── Broadcaster access ───────────────────────────────────────────────────
  // Returns the RequestEventBroadcaster associated with this panel.
  // The broadcaster is used by EagleEyeInterceptor to push request events
  // into the panel's JS context.
  RequestEventBroadcaster* GetBroadcaster() const {
    return broadcaster_.get();
  }

  // Singleton-per-browser accessor.  Returns nullptr if devmode is not
  // enabled or the browser has no DevModePanel attached.
  static DevModePanel* GetForBrowser(Browser* browser);

 private:
  // Registers the side panel entry with this window's SidePanelRegistry.
  void RegisterSidePanelEntry();

  // Binds Ctrl+Shift+D accelerator in the browser window's AcceleratorTable.
  void RegisterKeyboardShortcut();

  // Called by SidePanelCoordinator when the panel becomes visible/hidden.
  void OnPanelVisibilityChanged(bool visible);

  raw_ptr<Browser> browser_;

  bool panel_open_ = false;
  bool shortcut_registered_ = false;

  std::unique_ptr<RequestEventBroadcaster> broadcaster_;

  base::ObserverList<Observer> observers_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<DevModePanel> weak_factory_{this};

  DevModePanel(const DevModePanel&) = delete;
  DevModePanel& operator=(const DevModePanel&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_DEVMODE_PANEL_H_
