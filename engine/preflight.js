/**
 * 🛫 Preflight Stage Engine
 * Lightweight initial inspection collecting redirects, HTTP status, timing, & runtime errors.
 */
const config = require('./config');

async function runPreflight(page, targetUrl) {
  const result = {
    operationName: 'Homepage Navigation',
    targetUrl: targetUrl,
    finalUrl: targetUrl,
    httpStatus: null,
    redirectChain: [],
    navigationDurationMs: 0,
    navigationDurationSec: '0.0s',
    domContentLoadedMs: 0,
    loadTimingMs: 0,
    pageTitle: '',
    viewport: null,
    consoleErrors: [],
    uncaughtExceptions: [],
    failedNetworkRequests: [],
    success: false,
    errorMessage: null
  };

  const redirectChain = [];
  const failedRequests = [];
  const consoleErrors = [];
  const uncaughtExceptions = [];

  // 1. Attach Network & Console Listeners
  const requestListener = (req) => {
    const redirectResponse = req.redirectedFrom();
    if (redirectResponse) {
      redirectChain.push({
        from: redirectResponse.url(),
        to: req.url()
      });
    }
  };

  const responseListener = (res) => {
    const status = res.status();
    if (status >= 400) {
      failedRequests.push({
        url: res.url(),
        status: status,
        statusText: res.statusText(),
        method: res.request().method()
      });
    }
  };

  const consoleListener = (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  };

  const pageErrorListener = (err) => {
    uncaughtExceptions.push({
      message: err.message,
      stack: err.stack
    });
  };

  page.on('request', requestListener);
  page.on('response', responseListener);
  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  const startTime = Date.now();

  try {
    // 2. Perform Resilient Navigation with domcontentloaded fallback strategy
    let response = null;
    try {
      response = await page.goto(targetUrl, {
        waitUntil: config.navigationStrategy.waitUntil,
        timeout: config.timeouts.navigation
      });
    } catch (firstErr) {
      console.log(`[PREFLIGHT WARN] Primary navigation timed out, trying fallback: ${firstErr.message}`);
      response = await page.goto(targetUrl, {
        waitUntil: config.navigationStrategy.fallbackWaitUntil,
        timeout: config.timeouts.commitNavigation
      });
    }

    const navigationDurationMs = Date.now() - startTime;
    result.navigationDurationMs = navigationDurationMs;
    result.navigationDurationSec = `${(navigationDurationMs / 1000).toFixed(1)}s`;

    if (response) {
      result.httpStatus = response.status();
      result.finalUrl = page.url();
    }

    // Measure DOMContentLoaded & Load timing
    const timing = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return perf ? {
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd - perf.startTime),
        loadEvent: Math.round(perf.loadEventEnd - perf.startTime)
      } : { domContentLoaded: 0, loadEvent: 0 };
    }).catch(() => ({ domContentLoaded: 0, loadEvent: 0 }));

    result.domContentLoadedMs = timing.domContentLoaded || navigationDurationMs;
    result.loadTimingMs = timing.loadEvent || navigationDurationMs;

    result.pageTitle = await page.title().catch(() => '');
    result.viewport = page.viewportSize();
    result.redirectChain = redirectChain;
    result.consoleErrors = consoleErrors;
    result.uncaughtExceptions = uncaughtExceptions;
    result.failedNetworkRequests = failedRequests;

    if (result.httpStatus && result.httpStatus < 400) {
      result.success = true;
    } else {
      result.success = false;
      result.errorMessage = `HTTP Status Code returned non-success response: ${result.httpStatus}`;
    }

  } catch (err) {
    result.success = false;
    result.errorMessage = `Preflight Navigation Failure: ${err.message}`;
    result.navigationDurationMs = Date.now() - startTime;
  } finally {
    page.off('request', requestListener);
    page.off('response', responseListener);
    page.off('console', consoleListener);
    page.off('pageerror', pageErrorListener);
  }

  return result;
}

module.exports = {
  runPreflight
};
