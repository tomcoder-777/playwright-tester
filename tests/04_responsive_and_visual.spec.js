const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * TEST SUITE 4: Responsive Viewports & Visual Snapshots
 */
test.describe('4. Viewport & Visual Audits', () => {

  const ensureSnapshotDir = () => {
    const dir = path.join(__dirname, '..', 'snapshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  test('Capture Desktop Viewport Snapshot (1440px)', async ({ page, baseURL }) => {
    console.log(`[INFO] Capturing Desktop Snapshot for: ${baseURL}`);
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Navigate with networkidle fallback to ensure full rendering
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Allow dynamic images to settle

    const dir = ensureSnapshotDir();
    const screenshotPath = path.join(dir, 'desktop_view.png');
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[PASS] Desktop snapshot saved: ${screenshotPath}`);
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('Capture Mobile Viewport Snapshot (375px)', async ({ page, baseURL }) => {
    console.log(`[INFO] Capturing Mobile Snapshot for: ${baseURL}`);
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const dir = ensureSnapshotDir();
    const screenshotPath = path.join(dir, 'mobile_view.png');

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[PASS] Mobile snapshot saved: ${screenshotPath}`);
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

});
