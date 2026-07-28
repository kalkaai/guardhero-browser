// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.
//
// guardhero_action_button.h — Guard Hero shield toolbar button.
//
// Visual states:
//   ShieldState::ACTIVE  — Green shield: blocking on for this site
//   ShieldState::PAUSED  — Grey shield: site allowlisted or blocking paused
//   ShieldState::ALERT   — Red shield + count: trackers detected (pulsing)

#ifndef CHROME_BROWSER_GUARDHERO_GUARDHERO_ACTION_BUTTON_H_
#define CHROME_BROWSER_GUARDHERO_GUARDHERO_ACTION_BUTTON_H_

#include <cstdint>
#include <memory>

#include "base/memory/raw_ptr.h"
#include "base/timer/timer.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "ui/gfx/color_palette.h"
#include "ui/views/controls/button/button.h"

class Browser;

namespace guardhero {

enum class ShieldState {
  ACTIVE,   // Blocking on — green shield
  PAUSED,   // Blocking paused for site — grey shield
  ALERT,    // Trackers detected (non-zero count) — red shield + number badge
};

// GuardHeroActionButton — the Guard Hero shield button in the browser toolbar.
//
// Placed right of the omnibox via ToolbarView::Init().
// Clicking opens the GuardHero popup (browser-ui/popup/).
class GuardHeroActionButton : public ToolbarButton {
 public:
  explicit GuardHeroActionButton(Browser* browser);
  ~GuardHeroActionButton() override;

  // Update the button's visual state.
  void SetShieldState(ShieldState state, int64_t blocked_count = 0);
  ShieldState GetShieldState() const { return state_; }
  int64_t GetBlockedCount() const { return blocked_count_; }

  // views::View overrides
  void OnThemeChanged() override;

  // views::Button overrides
  void ButtonPressed(const ui::Event& event) override;

  // Update blocked count (called on each blocked request for current tab).
  void IncrementBlockedCount();

  // Reset count when tab navigates.
  void ResetForNavigation();

 private:
  // ── Pulsing animation for ALERT state ────────────────────────────────────
  void StartPulseAnimation();
  void StopPulseAnimation();
  void OnPulseTick();

  // ── Icon painting ─────────────────────────────────────────────────────────
  void UpdateIcon();

  // Brand colors
  static constexpr SkColor kColorActive = SkColorSetRGB(0x00, 0xD4, 0xFF);  // Cyan
  static constexpr SkColor kColorPaused = SkColorSetRGB(0x88, 0x88, 0x99);  // Grey
  static constexpr SkColor kColorAlert  = SkColorSetRGB(0xFF, 0x4B, 0x6E);  // Red

  raw_ptr<Browser> browser_;
  ShieldState state_ = ShieldState::ACTIVE;
  int64_t blocked_count_ = 0;
  bool pulse_on_ = false;
  base::RepeatingTimer pulse_timer_;

  GuardHeroActionButton(const GuardHeroActionButton&) = delete;
  GuardHeroActionButton& operator=(const GuardHeroActionButton&) = delete;
};

}  // namespace guardhero

#endif  // CHROME_BROWSER_GUARDHERO_GUARDHERO_ACTION_BUTTON_H_
