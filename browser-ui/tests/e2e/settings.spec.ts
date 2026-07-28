// Copyright (c) 2025 Guard Hero. All rights reserved.
// E2E tests — Settings Page (/settings/index.html)

import { test, expect } from '@playwright/test';

const SECTIONS = ['Privacy', 'EagleEye', 'Search', 'Appearance', 'Developer', 'About'] as const;

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/index.html');
  });

  test('renders without crashing', async ({ page }) => {
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('shows all navigation sections', async ({ page }) => {
    for (const section of SECTIONS) {
      await expect(page.getByText(section).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Privacy section is active by default', async ({ page }) => {
    // Privacy should be highlighted / have active class
    const activeNav = page.locator('.settings-nav-item.active, [class*="active"]').first();
    await expect(activeNav).toContainText(/Privacy/i, { timeout: 5000 });
  });

  test('clicking EagleEye section switches content', async ({ page }) => {
    await page.getByText('EagleEye').click();
    // EagleEye content should now be visible
    await expect(page.getByText(/EagleEye/i).nth(1)).toBeVisible({ timeout: 3000 });
  });

  test('clicking Developer section shows DevMode panel settings', async ({ page }) => {
    await page.getByText('Developer').click();
    await expect(page.getByText(/DevMode/i)).toBeVisible({ timeout: 3000 });
  });

  test('Developer section shows Local HTTPS toggle', async ({ page }) => {
    await page.getByText('Developer').click();
    await expect(page.getByText(/Local CA|local https|certificate/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('LocalHttpsManager renders when local CA toggle is on', async ({ page }) => {
    await page.getByText('Developer').click();
    // Default state: local CA enabled → LocalHttpsManager visible
    await expect(page.getByText(/Certificate Authority|issued cert|Regenerate/i).first()).toBeVisible({ timeout: 4000 });
  });

  test('toggles in Privacy section are interactive', async ({ page }) => {
    // Find first toggle on Privacy page
    const toggle = page.locator('.settings-toggle').first();
    await expect(toggle).toBeVisible({ timeout: 5000 });

    const wasBefore = await toggle.getAttribute('aria-checked') ??
                      await toggle.evaluate(el => el.classList.contains('on') ? 'true' : 'false');

    await toggle.click();
    await expect(page.locator('#root')).not.toBeEmpty();

    const isAfter = await toggle.getAttribute('aria-checked') ??
                    await toggle.evaluate(el => el.classList.contains('on') ? 'true' : 'false');

    // State should have flipped
    expect(isAfter).not.toEqual(wasBefore);
  });

  test('clicking About section shows version info', async ({ page }) => {
    await page.getByText('About').click();
    await expect(page.getByText(/Guard Hero|version|v\d/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('sidebar is sticky — scrolling content does not move sidebar', async ({ page }) => {
    const sidebarBefore = await page.locator('.settings-sidebar').boundingBox();
    await page.mouse.wheel(0, 500);
    const sidebarAfter  = await page.locator('.settings-sidebar').boundingBox();
    expect(sidebarBefore?.y).toBeCloseTo(sidebarAfter?.y ?? 0, 0);
  });
});
