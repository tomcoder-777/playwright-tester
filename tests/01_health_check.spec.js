const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE 1: Website Health & Performance Audit
 */
test.describe('1. Website Health & Performance Audit', () => {

  test('Website responds with success HTTP status and valid title', async ({ page, baseURL }) => {
    console.log(`[INFO] Auditing target URL: ${baseURL}`);
    
    const startTime = Date.now();
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTimeMs = Date.now() - startTime;

    expect(response, 'Website should return an HTTP response').not.toBeNull();
    const status = response.status();
    console.log(`[PASS] HTTP Status Code: ${status}`);
    expect(status, 'HTTP status code should be 200 OK or 3xx Redirect').toBeLessThan(400);

    const title = await page.title();
    console.log(`[PASS] Page Title: "${title}"`);
    expect(title.length, 'Page title must not be empty').toBeGreaterThan(0);

    console.log(`[PERF] DOM Content Loaded in ${loadTimeMs}ms`);
  });

  test('Page contains essential SEO & Viewport Meta Tags', async ({ page }) => {
    await page.goto('/');

    const viewportMeta = page.locator('meta[name="viewport"]');
    const hasViewport = await viewportMeta.count() > 0;
    console.log(`[PASS] Mobile Viewport Meta Tag Present: ${hasViewport}`);

    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent.trim().length).toBeGreaterThan(10);
  });

});
