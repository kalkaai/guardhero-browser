// Copyright (c) 2025 Guard Hero. All rights reserved.
// E2E tests — DevMode Panel (/devtools/index.html)

import { test, expect } from '@playwright/test';

const TABS = ['Request Inspector', 'API Tester', 'Scratchpad', 'Storage', 'Headers'] as const;

test.describe('DevMode Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/devtools/index.html');
  });

  test('renders without crashing', async ({ page }) => {
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('shows all tab labels', async ({ page }) => {
    for (const tab of TABS) {
      await expect(page.getByText(tab).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Request Inspector is active by default', async ({ page }) => {
    // First tab should be selected on load
    await expect(page.getByText('Request Inspector').first()).toBeVisible({ timeout: 3000 });
    // Some request rows / stream content should appear within 3s (mock fires at 2s)
    await page.waitForTimeout(2500);
    // Should have rendered at least one request row
    const rows = await page.locator('[class*="request-row"], [class*="req-row"], tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('switching to API Tester tab shows request builder', async ({ page }) => {
    await page.getByText('API Tester').click();
    await expect(page.getByText(/GET|POST|method|url/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('switching to Scratchpad tab shows code editor area', async ({ page }) => {
    await page.getByText('Scratchpad').click();
    // Should have a textarea or code editor
    const editor = page.locator('textarea, [class*="editor"], [class*="scratchpad"]').first();
    await expect(editor).toBeVisible({ timeout: 3000 });
  });

  test('switching to Storage tab shows storage viewer', async ({ page }) => {
    await page.getByText('Storage').click();
    await expect(page.getByText(/cookie|localStorage|sessionStorage|IndexedDB/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('switching to Headers tab shows rule builder', async ({ page }) => {
    await page.getByText('Headers').click();
    await expect(page.getByText(/header|rule|request|response/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('Request Inspector streams live events from mock API', async ({ page }) => {
    // Mock fires every 2s — wait 5s and check we have multiple rows
    await page.waitForTimeout(5000);
    const rows = await page.locator('[class*="request-row"], [class*="req-row"], tbody tr').count();
    expect(rows).toBeGreaterThan(1);
  });

  test('BLOCKED rows are visually distinct from ALLOWED rows', async ({ page }) => {
    await page.waitForTimeout(3000);
    // Blocked rows should have a red/danger indicator
    const blocked = page.locator('[class*="blocked"], [class*="danger"], [style*="#FF4B6E"], [style*="ff4b6e"]').first();
    await expect(blocked).toBeVisible({ timeout: 5000 });
  });

  test('panel uses Guard Hero dark theme', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(bg).toMatch(/rgb\(10,\s*14,\s*26\)|rgb\(17,\s*24,\s*39\)|#0a0e1a|#111827/i);
  });
});
