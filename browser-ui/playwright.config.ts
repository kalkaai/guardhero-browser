// Copyright (c) 2025 Guard Hero. All rights reserved.
// Playwright E2E configuration — Tier 3 testing.
//
// Requires a running Vite dev server (Tier 1).
// Run with: npm run test:e2e
// Interactive UI:  npm run test:e2e:ui

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Dark theme — match Guard Hero's color scheme in assertions
    colorScheme: 'dark',
  },

  // Expect Vite to already be running (Tier 1).
  // To auto-start it, uncomment:
  // webServer: {
  //   command: 'npm run dev',
  //   url: BASE_URL,
  //   reuseExistingServer: true,
  // },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
