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
    errorMessage: null,
    retried: false,
    connectionUncertain: false
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

  // A single navigation attempt (the existing two-step domcontentloaded -> commit strategy).
  // Throws if both steps fail — the caller below decides whether that's worth retrying.
  async function attemptNavigation() {
    try {
      return await page.goto(targetUrl, {
        waitUntil: config.navigationStrategy.waitUntil,
        timeout: config.timeouts.navigation
      });
    } catch (firstErr) {
      console.log(`[PREFLIGHT WARN] Primary navigation timed out, trying fallback: ${firstErr.message}`);
      return await page.goto(targetUrl, {
        waitUntil: config.navigationStrategy.fallbackWaitUntil,
        timeout: config.timeouts.commitNavigation
      });
    }
  }

  try {
    // 2. Perform Resilient Navigation, retrying once on a total failure before concluding
    // the site itself is down. A single timeout is ambiguous — it could be a genuinely dead
    // site, or it could just as easily be a momentary blip on the network the test is running
    // from. One retry after a short pause filters out that second, far more common case.
    let response = null;
    try {
      response = await attemptNavigation();
    } catch (firstAttemptErr) {
      console.log(`[PREFLIGHT WARN] Navigation failed entirely, retrying once after a short pause: ${firstAttemptErr.message}`);
      result.retried = true;
      await new Promise(r => setTimeout(r, 1500));
      response = await attemptNavigation();
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
    result.navigationDurationMs = Date.now() - startTime;

    // A DNS "name not found" error means the domain itself doesn't resolve — that's a real,
    // unambiguous problem with the target, not a connectivity blip. Everything else that
    // still fails after a retry (timeouts, reset connections, "internet disconnected") is
    // genuinely ambiguous — it could be the site being down, or it could be an unstable
    // connection on the machine running this test. Say so honestly instead of guessing.
    const isDefinitiveDnsFailure = /ERR_NAME_NOT_RESOLVED/i.test(err.message);
    if (isDefinitiveDnsFailure) {
      result.errorMessage = `The domain could not be found (DNS lookup failed): ${err.message}`;
      result.connectionUncertain = false;
    } else {
      result.connectionUncertain = true;
      result.errorMessage = result.retried
        ? `Could not load the page even after retrying once: ${err.message}. This could mean the site is down, or that the internet connection running this test is unstable — the test alone can't tell which.`
        : `Preflight Navigation Failure: ${err.message}`;
    }
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
