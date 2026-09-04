/**
 * 🖱️ Control Interaction Auditor
 * Exercises safe, non-destructive interactive controls (buttons, tabs, menu items)
 * with hover, focus, and — where it cannot trigger a form submission or a
 * classified-destructive action — a real click. Correlates browser console/network
 * failures observed during each interaction back to the specific control.
 */
const config = require('./config');

async function auditInteractions(page, interactiveElements, monitor) {
  const startTime = Date.now();
  const results = {
    operationName: 'Test Interactive Controls',
    elementsDiscovered: 0,
    elementsTested: 0,
    hoveredOnly: 0,
    clicked: 0,
    skippedUnsafe: 0,
    errorsTriggered: [],
    traceLogs: [],
    durationMs: 0
  };

  const maxElements = (config.interactionAuditor && config.interactionAuditor.maxElementsToTest) || 8;
  const hoverDelay = (config.interactionAuditor && config.interactionAuditor.hoverDelayMs) || 150;
  const settleDelay = (config.interactionAuditor && config.interactionAuditor.postClickSettleMs) || 300;

  // Candidates: buttons/tabs/menu-items that are visible, enabled, and not classified destructive.
  // Form text inputs are already exercised by the form auditor, so exclude plain text-entry fields here.
  const candidates = interactiveElements.filter(el =>
    el.isVisible &&
    !el.isDisabled &&
    el.isSafe &&
    !['text', 'search', 'email', 'password', 'textarea', 'select', 'number', 'tel', 'url'].includes(el.type)
  );

  results.elementsDiscovered = candidates.length;
  results.skippedUnsafe = interactiveElements.filter(el => !el.isSafe).length;
  results.traceLogs.push(`Test Interactive Controls — ${candidates.length} eligible control(s) found, ${results.skippedUnsafe} skipped as destructive/unsafe`);

  const originalUrl = page.url();

  // Baseline of error messages already observed before any interaction began (e.g. a
  // recurring ad/analytics beacon that fails on every page load). These are excluded from
  // attribution below so ambient, unrelated noise isn't blamed on a specific click.
  const baselineErrorTexts = new Set(
    monitor ? [...monitor.consoleErrors, ...monitor.uncaughtExceptions].map(e => e.text || e.message) : []
  );

  for (const el of candidates.slice(0, maxElements)) {
    if (el.qaIndex === undefined || el.qaIndex === null) continue;

    const selector = `[data-qa-idx="${el.qaIndex}"]`;
    const label = el.text || el.ariaLabel || el.name || el.id || `<${el.tagName}>`;
    const locator = page.locator(selector).first();

    const consoleErrBefore = monitor ? monitor.consoleErrors.length : 0;
    const uncaughtExcBefore = monitor ? monitor.uncaughtExceptions.length : 0;

    try {
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) continue;

      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.hover({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(hoverDelay);
      await locator.focus().catch(() => {});
      results.elementsTested++;

      // Only click controls that cannot trigger an implicit form submission:
      // explicit type="button" elements, or any control that lives outside a <form>.
      const isImplicitSubmit = el.isInForm && (el.tagName === 'button' ? el.type !== 'button' : el.type === 'submit');
      const safeToClick = !isImplicitSubmit;

      if (safeToClick) {
        await locator.click({ timeout: 3000, trial: false }).catch(() => {});
        await page.waitForTimeout(settleDelay);
        results.clicked++;

        const newUrl = page.url();
        if (newUrl !== originalUrl) {
          results.traceLogs.push(`Test Interactive Controls — clicking "${label}" navigated to ${newUrl}, returning to baseline page`);
          await page.goto(originalUrl, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation }).catch(() => {});
          await page.waitForTimeout(200);
        }
      } else {
        results.hoveredOnly++;
        results.traceLogs.push(`Test Interactive Controls — "${label}" is an implicit form-submit control, hover/focus only (click skipped to avoid unauthorized submission)`);
      }

      const rawNewErrors = monitor ? [
        ...monitor.consoleErrors.slice(consoleErrBefore),
        ...monitor.uncaughtExceptions.slice(uncaughtExcBefore)
      ] : [];

      // Exclude messages already present before interactions began — ambient/recurring
      // noise (e.g. a background beacon) rather than something this specific click caused.
      const attributableErrors = rawNewErrors.filter(e => !baselineErrorTexts.has(e.text || e.message));

      if (attributableErrors.length > 0) {
        results.errorsTriggered.push({
          element: label,
          selector: `<${el.tagName}${el.id ? ` id="${el.id}"` : ''}>`,
          details: attributableErrors.map(e => e.text || e.message).join('; ')
        });
        results.traceLogs.push(`Test Interactive Controls — interaction with "${label}" triggered ${attributableErrors.length} new console/runtime error(s)`);
      } else {
        if (rawNewErrors.length > 0) {
          rawNewErrors.forEach(e => baselineErrorTexts.add(e.text || e.message));
        }
        results.traceLogs.push(`Test Interactive Controls — "${label}" responded to hover/focus${safeToClick ? '/click' : ''} cleanly`);
      }
    } catch (err) {
      results.traceLogs.push(`Test Interactive Controls — interaction with "${label}" raised: ${err.message}`);
    }
  }

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Test Interactive Controls completed in ${(results.durationMs / 1000).toFixed(2)}s`);

  return results;
}

module.exports = {
  auditInteractions
};
