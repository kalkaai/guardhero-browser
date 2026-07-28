// Copyright (c) 2025 Guard Hero. All rights reserved.
// E2E tests — Toolbar Popup (/popup/index.html)

import { test, expect } from '@playwright/test';

test.describe('Toolbar Popup', () => {
  test.beforeEach(async ({ page }) => {
    // Popup is 380×560 — match real extension popup dimensions
    await page.setViewportSize({ width: 380, height: 560 });
    await page.goto('/popup/index.html');
  });

  test('renders without crashing', async ({ page }) => {
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('shows shield / Guard Hero branding', async ({ page }) => {
    const hasShield = await page.locator('text=/Guard Hero/i, [class*="shield"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasShield).toBe(true);
  });

  test('shows blocked tracker count for current page', async ({ page }) => {
    // Mock returns 12 blocked trackers for tab 1
    await expect(page.getByText(/12/)).toBeVisible({ timeout: 5000 });
  });

  test('shows tracker list with known domains', async ({ page }) => {
    // Mock blocked_trackers includes these domains
    await expect(page.getByText(/doubleclick\.net/i)).toBeVisible({ timeout: 5000 });
  });

  test('shield toggle is present and interactive', async ({ page }) => {
    const toggle = page.locator(
      'button[role="switch"], input[type="checkbox"], [class*="toggle"], [class*="shield-toggle"]'
    ).first();
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Click the toggle — should not crash
    await toggle.click();
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('allow site button is present', async ({ page }) => {
    const allowBtn = page.getByText(/allow/i).first();
    await expect(allowBtn).toBeVisible({ timeout: 5000 });
  });

  test('clicking allow site does not crash', async ({ page }) => {
    const allowBtn = page.getByText(/allow/i).first();
    await allowBtn.click();
    // Page should still be alive
    await expect(page.locator('#root')).not.toBeEmpty();
  });
});
