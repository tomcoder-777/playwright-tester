/**
 * ⏳ Client-Side Render Hydration Wait
 * Many modern sites (React/Vue/Next.js/SPA) respond with a near-empty HTML shell at
 * `domcontentloaded` and inject the real page content — links, buttons, forms, text —
 * via JavaScript shortly after. A DOM scan that runs immediately at `domcontentloaded`
 * on such a site sees nothing. This gives the page a bounded window to render real
 * content before any stage (discovery, interaction, responsive) inspects the DOM.
 */
const config = require('./config');

async function waitForHydration(page) {
  const cfg = config.hydrationWait || { enabled: true, timeoutMs: 8000 };
  if (!cfg.enabled) return;

  try {
    await page.waitForFunction(
      () => {
        const hasText = document.body && document.body.innerText && document.body.innerText.trim().length > 20;
        const hasInteractive = document.querySelectorAll('a[href], button, input, textarea, select, form').length > 0;
        return hasText || hasInteractive;
      },
      { timeout: cfg.timeoutMs }
    );
  } catch (e) {
    // Best-effort: page may genuinely be static/empty, or hydration is slower than the
    // budget allows. Downstream stages still run against whatever DOM state exists.
  }
}

module.exports = {
  waitForHydration
};
