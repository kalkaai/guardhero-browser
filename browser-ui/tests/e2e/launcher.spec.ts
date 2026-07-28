// Copyright (c) 2025 Guard Hero. All rights reserved.
// E2E tests — Dev Launcher (/)

import { test, expect } from '@playwright/test';

test.describe('Dev Launcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('renders Guard Hero branding', async ({ page }) => {
    await expect(page.getByText('Guard Hero Browser')).toBeVisible({ timeout: 5000 });
  });

  test('shows all four panel cards', async ({ page }) => {
    await expect(page.getByText('New Tab Page')).toBeVisible();
    await expect(page.getByText('Toolbar Popup')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('DevMode Panel')).toBeVisible();
  });

  test('New Tab card navigates to /newtab/index.html', async ({ page }) => {
    await page.getByText('New Tab Page').click();
    await expect(page).toHaveURL(/newtab\/index\.html/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('Popup card navigates to /popup/index.html', async ({ page }) => {
    await page.getByText('Toolbar Popup').click();
    await expect(page).toHaveURL(/popup\/index\.html/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('Settings card navigates to /settings/index.html', async ({ page }) => {
    await page.getByText('Settings').click();
    await expect(page).toHaveURL(/settings\/index\.html/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('DevMode card navigates to /devtools/index.html', async ({ page }) => {
    await page.getByText('DevMode Panel').click();
    await expect(page).toHaveURL(/devtools\/index\.html/);
    await expect(page.locator('#root')).not.toBeEmpty();
  });
});
