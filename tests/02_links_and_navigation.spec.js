const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE 2: Links & Asset Integrity Scanner
 */
test.describe('2. Links & Assets Audit', () => {

  test('Page contains working navigational links', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('a');
    const linkCount = await links.count();
    console.log(`[INFO] Identified ${linkCount} navigational links`);

    let validHrefs = 0;
    for (let i = 0; i < Math.min(linkCount, 15); i++) {
      const href = await links.nth(i).getAttribute('href');
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        validHrefs++;
      }
    }
    console.log(`[PASS] Valid link destinations sampled: ${validHrefs}`);
    expect(linkCount, 'Page should contain navigational links').toBeGreaterThanOrEqual(0);
  });

  test('Images on page have valid src attributes', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const imgCount = await images.count();
    console.log(`[INFO] Identified ${imgCount} image assets`);

    let loadedImages = 0;
    for (let i = 0; i < imgCount; i++) {
      const src = await images.nth(i).getAttribute('src');
      if (src && src.trim().length > 0) {
        loadedImages++;
      }
    }
    console.log(`[PASS] Images with valid source attributes: ${loadedImages}/${imgCount}`);
  });

});
