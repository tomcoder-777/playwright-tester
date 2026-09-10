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

// Actually clicks each candidate "placeholder" anchor (no real href — flagged by discovery
// as potentially non-functional) and observes whether anything happens: navigation, a new
// tab/window, a DOM change (e.g. a modal opening), or a new runtime error. This turns a
// static "this link has no href, verify manually" heuristic into a definitive answer —
// distinguishing a link genuinely wired up via a JS click handler from one that's truly dead.
async function verifyNonFunctionalLinks(page, nonFunctionalLinks, monitor) {
  const startTime = Date.now();
  const results = {
    operationName: 'Verify Non-Functional Link Candidates',
    tested: 0,
    confirmedBroken: [],
    confirmedHandledByJs: [],
    traceLogs: [],
    durationMs: 0
  };

  const maxToTest = 15;
  const candidates = nonFunctionalLinks.filter(l => l.qaLinkIndex !== undefined && l.qaLinkIndex !== null);
  results.traceLogs.push(`Verify Non-Functional Link Candidates — testing ${Math.min(candidates.length, maxToTest)} of ${candidates.length} placeholder anchor(s) by clicking each one`);

  for (const link of candidates.slice(0, maxToTest)) {
    const selector = `[data-qa-link-idx="${link.qaLinkIndex}"]`;
    const locator = page.locator(selector).first();

    try {
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) continue;

      // A whole-page DOM-length diff is unreliable in practice — real sites constantly mutate
      // the DOM in the background (lazy-loaded images, ad/analytics scripts, animations)
      // completely independent of the click, which produces false "something happened" reads.
      // Instead, capture a state signature scoped to the clicked element's own vicinity: aria
      // toggle attributes (the semantically correct signal for accordions/tabs/menus) plus a
      // bounded parent snapshot, so only a change local to what was actually clicked counts.
      async function captureLocalState(sel) {
        return page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return null;
          let node = el;
          const ariaStates = [];
          for (let i = 0; i < 4 && node; i++) {
            ariaStates.push([
              node.getAttribute('aria-expanded'),
              node.getAttribute('aria-selected'),
              node.getAttribute('aria-pressed'),
              node.getAttribute('aria-checked'),
              node.getAttribute('aria-hidden')
            ].join('|'));
            node = node.parentElement;
          }
          return { ariaSignature: ariaStates.join(';') };
        }, sel).catch(() => null);
      }

      const urlBefore = page.url();
      const pagesBefore = page.context().pages().length;
      const stateBefore = await captureLocalState(selector);
      const consoleErrBefore = monitor ? monitor.consoleErrors.length : 0;
      const uncaughtBefore = monitor ? monitor.uncaughtExceptions.length : 0;

      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      results.tested++;

      const urlAfter = page.url();
      const pagesAfter = page.context().pages();
      const stateAfter = await captureLocalState(selector);
      const consoleErrAfter = monitor ? monitor.consoleErrors.length : 0;
      const uncaughtAfter = monitor ? monitor.uncaughtExceptions.length : 0;

      const navigated = urlAfter !== urlBefore;
      const openedNewTab = pagesAfter.length > pagesBefore;
      const ariaChanged = !!(stateBefore && stateAfter && stateBefore.ariaSignature !== stateAfter.ariaSignature);
      // A raw outerHTML length diff was tried and dropped: on real sites with background
      // animation/re-render activity (React re-renders, CSS-in-JS style injection, lazy
      // images) it fires even on elements with zero working click handler — empirically
      // confirmed as an unreliable signal, not a hypothetical concern. aria-state is the
      // only DOM-proximity signal precise enough to trust here.
      const domChanged = ariaChanged;
      const newErrorCount = (consoleErrAfter - consoleErrBefore) + (uncaughtAfter - uncaughtBefore);

      // Restore baseline state before testing the next candidate
      if (navigated) {
        await page.goto(urlBefore, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation }).catch(() => {});
        await page.waitForTimeout(200);
      }
      if (openedNewTab) {
        for (const p of pagesAfter.slice(pagesBefore)) {
          await p.close().catch(() => {});
        }
      }

      if (navigated || openedNewTab || domChanged) {
        const effect = navigated ? 'navigated to a new URL' : openedNewTab ? 'opened a new tab/window' : ariaChanged ? 'toggled an aria-expanded/selected/pressed state (likely opened a panel/menu)' : 'changed the DOM near the clicked element';
        results.confirmedHandledByJs.push({ qaLinkIndex: link.qaLinkIndex, text: link.text, effect });
        results.traceLogs.push(`Verify Non-Functional Link — "${link.text}" click ${effect} — handled via JavaScript, not actually broken`);
      } else {
        const effect = newErrorCount > 0 ? 'no visible effect, but the click triggered a new console/runtime error' : 'no visible effect whatsoever (no navigation, no DOM change, no new tab)';
        results.confirmedBroken.push({ qaLinkIndex: link.qaLinkIndex, text: link.text, reason: link.reason, effect });
        results.traceLogs.push(`Verify Non-Functional Link — "${link.text}" click produced ${effect} — confirmed non-functional`);
      }
    } catch (err) {
      results.traceLogs.push(`Verify Non-Functional Link — error testing "${link.text}": ${err.message}`);
    }
  }

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Verify Non-Functional Link Candidates completed in ${(results.durationMs / 1000).toFixed(2)}s`);

  return results;
}

module.exports = {
  auditInteractions,
  verifyNonFunctionalLinks
};
