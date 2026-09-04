const { test, expect } = require('@playwright/test');
const { humanType, humanClick } = require('./helpers/human_actions');

/**
 * TEST SUITE 3: Interactive Controls & User Simulation
 */
test.describe('3. User Interaction Audit', () => {

  test('Interactive buttons and controls respond to mouse events', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('button, input[type="submit"], a.btn, .button');
    const buttonCount = await buttons.count();
    console.log(`[INFO] Identified ${buttonCount} interactive buttons/controls`);

    if (buttonCount > 0) {
      const firstBtn = buttons.first();
      await expect(firstBtn).toBeVisible();
      
      console.log('[INFO] Executing hover and click event on primary control...');
      await humanClick(firstBtn);
      console.log('[PASS] Control visibility and clickability verified');
    } else {
      console.log('[INFO] No explicit button elements identified on root view');
    }
  });

  test('Input fields accept keystroke events with natural delays', async ({ page }) => {
    await page.goto('/');

    const inputs = page.locator('input[type="text"], input[type="search"], input[type="email"], textarea');
    const inputCount = await inputs.count();
    console.log(`[INFO] Identified ${inputCount} input fields`);

    if (inputCount > 0) {
      const firstInput = inputs.first();
      await firstInput.scrollIntoViewIfNeeded();
      
      console.log('[INFO] Simulating input typing events...');
      await humanType(firstInput, 'Automated Test Query');
      
      const val = await firstInput.inputValue();
      expect(val).toContain('Automated Test Query');
      console.log(`[PASS] Input verification successful: "${val}"`);
    } else {
      console.log('[INFO] No input fields identified on root view');
    }
  });

});
