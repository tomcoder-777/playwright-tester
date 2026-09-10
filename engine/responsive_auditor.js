/**
 * 📱 Responsive & Viewport Layout Auditor Module
 * Evaluates 1440px Desktop & 375px Mobile viewports with real DOM layout assertions.
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { waitForHydration } = require('./hydration_wait');

async function auditResponsiveLayout(page, targetUrl) {
  const startTime = Date.now();
  const results = {
    operationName: 'Viewport & Responsive Layout',
    desktop: { viewport: '1440x900', overflow: false, clippedElements: 0, snapshotPath: null },
    mobile: { viewport: '375x812', overflow: false, clippedElements: 0, snapshotPath: null },
    layoutIssues: [],
    traceLogs: [],
    durationMs: 0
  };

  const snapshotDir = path.join(__dirname, '..', 'snapshots');
  if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

  // 1. Audit Desktop Viewport (1440px)
  try {
    await page.setViewportSize(config.viewports.desktop);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation });
    await waitForHydration(page);
    await page.waitForTimeout(300);

    const desktopLayout = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      return {
        overflow: docWidth > winWidth + 5,
        docWidth,
        winWidth
      };
    });

    results.desktop.overflow = desktopLayout.overflow;
    results.traceLogs.push(`Viewport & Responsive Layout — Desktop 1440px evaluated (docWidth: ${desktopLayout.docWidth}px)`);

    if (desktopLayout.overflow) {
      results.layoutIssues.push({
        viewport: 'Desktop (1440px)',
        issue: 'Horizontal Layout Overflow',
        details: `Page document width (${desktopLayout.docWidth}px) exceeds viewport width (${desktopLayout.winWidth}px), causing unwanted horizontal scrolling.`
      });
    }

    const desktopSnapshotPath = path.join(snapshotDir, 'desktop_view.png');
    await page.screenshot({ path: desktopSnapshotPath, fullPage: true });
    results.desktop.snapshotPath = '/snapshots/desktop_view.png';

  } catch (err) {
    console.log(`[RESPONSIVE WARN] Desktop audit warning: ${err.message}`);
  }

  // 2. Audit Mobile Viewport (375px)
  try {
    await page.setViewportSize(config.viewports.mobile);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation });
    await waitForHydration(page);
    await page.waitForTimeout(300);

    const mobileLayout = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      return {
        overflow: docWidth > winWidth + 5,
        docWidth,
        winWidth
      };
    });

    results.mobile.overflow = mobileLayout.overflow;
    results.traceLogs.push(`Viewport & Responsive Layout — Mobile 375px evaluated (docWidth: ${mobileLayout.docWidth}px)`);

    if (mobileLayout.overflow) {
      results.layoutIssues.push({
        viewport: 'Mobile (375px)',
        issue: 'Horizontal Layout Overflow on Mobile Screen',
        details: `Mobile document width (${mobileLayout.docWidth}px) exceeds 375px mobile viewport width, causing content to break out of container bounds.`
      });
    }

    const mobileSnapshotPath = path.join(snapshotDir, 'mobile_view.png');
    await page.screenshot({ path: mobileSnapshotPath, fullPage: true });
    results.mobile.snapshotPath = '/snapshots/mobile_view.png';

  } catch (err) {
    console.log(`[RESPONSIVE WARN] Mobile audit warning: ${err.message}`);
  }

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Viewport & Responsive Layout completed in ${(results.durationMs / 1000).toFixed(2)}s`);

  return results;
}

module.exports = {
  auditResponsiveLayout
};
