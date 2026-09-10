const { defineConfig, devices } = require('@playwright/test');

const targetUrl = process.env.TARGET_URL || 'https://example.com';

module.exports = defineConfig({
  testDir: './tests',
  // The full black-box audit runs 9 sequential stages (navigation, multi-page crawl,
  // concurrent link/asset checks, form + interaction testing, dual-viewport screenshots)
  // against a real, uncontrolled website — Playwright's 30s default is far too tight for
  // that and was causing "Test timeout exceeded" failures on real sites. 3 minutes gives
  // the pipeline realistic headroom while still catching a genuinely hung run.
  timeout: 180_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Overridable per invocation (PW_HTML_REPORT_DIR / PW_OUTPUT_DIR) so the hosted dashboard
  // can point each concurrent audit job at its own isolated directory instead of every job
  // overwriting the same shared report/output folders.
  outputDir: process.env.PW_OUTPUT_DIR || 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: process.env.PW_HTML_REPORT_DIR || 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: targetUrl,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 10000,
    navigationTimeout: 15000
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome' // Uses installed Chrome browser if available
      },
    },
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }
  ],
});
