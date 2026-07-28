// Copyright (c) 2025 Guard Hero. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/guardhero/guardhero_action_button.h"

#include "base/time/time.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/views/bubble/webui_bubble_dialog_view.h"
#include "chrome/browser/guardhero/guardhero_url_constants.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/image/image.h"
#include "ui/gfx/paint_vector_icon.h"
#include "ui/views/accessibility/view_accessibility.h"

namespace guardhero {

GuardHeroActionButton::GuardHeroActionButton(Browser* browser)
    : ToolbarButton(
          base::BindRepeating(&GuardHeroActionButton::ButtonPressed,
                              base::Unretained(this))),
      browser_(browser) {
  SetAccessibleName(u"Guard Hero — blocking active");
  SetTooltipText(u"Guard Hero Shield");
  UpdateIcon();
}

GuardHeroActionButton::~GuardHeroActionButton() {
  StopPulseAnimation();
}

void GuardHeroActionButton::SetShieldState(ShieldState state,
                                             int64_t blocked_count) {
  state_ = state;
  blocked_count_ = blocked_count;

  switch (state) {
    case ShieldState::ACTIVE:
      SetAccessibleName(u"Guard Hero — blocking active");
      StopPulseAnimation();
      break;
    case ShieldState::PAUSED:
      SetAccessibleName(u"Guard Hero — blocking paused for this site");
      StopPulseAnimation();
      break;
    case ShieldState::ALERT:
      SetAccessibleName(u"Guard Hero — trackers detected");
      StartPulseAnimation();
      break;
  }

  UpdateIcon();
  SchedulePaint();
}

void GuardHeroActionButton::IncrementBlockedCount() {
  ++blocked_count_;
  if (blocked_count_ > 0 && state_ != ShieldState::PAUSED) {
    SetShieldState(ShieldState::ALERT, blocked_count_);
  }
}

void GuardHeroActionButton::ResetForNavigation() {
  blocked_count_ = 0;
  if (state_ != ShieldState::PAUSED) {
    SetShieldState(ShieldState::ACTIVE, 0);
  }
}

void GuardHeroActionButton::ButtonPressed(const ui::Event& event) {
  // Open the Guard Hero popup (guardhero://popup WebUI bubble)
  // Full implementation uses WebUIBubbleDialogView pointed at the popup page
  browser_->window()->ShowGuardHeroPopup();
}

void GuardHeroActionButton::OnThemeChanged() {
  ToolbarButton::OnThemeChanged();
  UpdateIcon();
}

void GuardHeroActionButton::UpdateIcon() {
  SkColor color;
  switch (state_) {
    case ShieldState::ACTIVE: color = kColorActive; break;
    case ShieldState::PAUSED: color = kColorPaused; break;
    case ShieldState::ALERT:
      color = pulse_on_ ? kColorAlert : SK_ColorWHITE;
      break;
  }
  // In full impl: set custom vector icon drawn with the shield SVG path
  // SetImageModel(ButtonState::STATE_NORMAL, ui::ImageModel::FromVectorIcon(
  //     kGuardHeroShieldIcon, color, 20));
  (void)color;
}

void GuardHeroActionButton::StartPulseAnimation() {
  if (pulse_timer_.IsRunning()) return;
  pulse_timer_.Start(FROM_HERE, base::Milliseconds(600),
                     this, &GuardHeroActionButton::OnPulseTick);
}

void GuardHeroActionButton::StopPulseAnimation() {
  pulse_timer_.Stop();
  pulse_on_ = false;
}

void GuardHeroActionButton::OnPulseTick() {
  pulse_on_ = !pulse_on_;
  UpdateIcon();
  SchedulePaint();
}

}  // namespace guardhero
