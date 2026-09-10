/**
 * 🔗 Fast Navigation & Link Auditor Module
 * Audits internal and external links using deduplicated URLs, controlled HTTP request concurrency,
 * and detailed operation trace logging.
 */
const config = require('./config');

async function auditLinksFast(requestContext, discoveredPages, targetUrl) {
  const startTime = Date.now();
  const concurrency = (config.linkAuditor && config.linkAuditor.concurrency) || 8;
  const timeout = (config.linkAuditor && config.linkAuditor.timeout) || 5000;
  const maxLinks = (config.linkAuditor && config.linkAuditor.maxLinksToAudit) || 25;

  const results = {
    operationName: 'Validate Internal Links',
    totalAudited: 0,
    uniqueLinksCount: 0,
    validLinks: 0,
    brokenLinks: [],
    restrictedLinks: [],
    unverifiableLinks: [],
    redirects: [],
    traceLogs: [],
    durationMs: 0
  };

  // 1. Deduplicate Link URLs
  const uniqueUrlMap = new Map();
  uniqueUrlMap.set(targetUrl, { url: targetUrl, text: 'Target Endpoint' });

  for (const pageItem of discoveredPages) {
    if (pageItem.url && !uniqueUrlMap.has(pageItem.url)) {
      uniqueUrlMap.set(pageItem.url, pageItem);
    }
  }

  const sampledItems = Array.from(uniqueUrlMap.values()).slice(0, maxLinks);
  results.uniqueLinksCount = sampledItems.length;
  results.traceLogs.push(`Validate Internal Links — ${discoveredPages.length} discovered pages deduplicated to ${sampledItems.length} unique audit targets`);

  // 2. Concurrent Worker Pool
  // A request that gets a real HTTP response (even an error one, like 404) is a confirmed
  // fact about the target. A request that times out or the connection resets got NO response
  // at all — that's just as likely to be a momentary network blip on our end as a real
  // problem with the link, so it's retried once before being trusted, and even then it's
  // tracked separately as "couldn't verify" rather than asserted as broken.
  async function fetchOnce(url) {
    return requestContext.fetch(url, { method: 'GET', maxRedirects: 5, timeout: timeout });
  }

  async function checkLink(item) {
    const linkStart = Date.now();
    const url = item.url;
    results.totalAudited++;

    let response = null;
    let networkError = null;
    let attempts = 0;

    for (attempts = 1; attempts <= 2; attempts++) {
      try {
        response = await fetchOnce(url);
        networkError = null;
        break;
      } catch (err) {
        networkError = err;
        if (attempts === 1) await new Promise(r => setTimeout(r, 500));
      }
    }

    const elapsedSec = ((Date.now() - linkStart) / 1000).toFixed(2);

    if (response) {
      const status = response.status();
      results.traceLogs.push(`GET "${url}" — status ${status} — ${elapsedSec}s${attempts > 1 ? ' (succeeded on retry)' : ''}`);

      if (status === 401 || status === 403) {
        // Access-gated, not actually dead: a real visitor gets an auth prompt/permission
        // wall rather than a broken navigation. Track separately from real breakage.
        results.restrictedLinks.push({
          url: url,
          status: status,
          statusText: response.statusText(),
          anchorText: item.text
        });
      } else if (status >= 400) {
        results.brokenLinks.push({
          url: url,
          status: status,
          statusText: response.statusText(),
          anchorText: item.text
        });
      } else {
        results.validLinks++;
        if (response.url() !== url) {
          results.redirects.push({
            originalUrl: url,
            finalUrl: response.url(),
            status: status
          });
        }
      }
    } else {
      // Both attempts failed with no HTTP response at all — genuinely can't tell whether
      // the link is broken or the test's own connection is unstable right now.
      results.traceLogs.push(`GET "${url}" — ERROR ${networkError.message} (after retry) — ${elapsedSec}s`);
      results.unverifiableLinks.push({
        url: url,
        statusText: `Could not get a response after 2 attempts: ${networkError.message}`,
        anchorText: item.text
      });
    }
  }

  // Execute pool with concurrency limit
  const pool = [];
  for (const item of sampledItems) {
    const p = checkLink(item);
    pool.push(p);

    if (pool.length >= concurrency) {
      await Promise.race(pool);
    }
  }
  await Promise.all(pool);

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Validate Internal Links completed in ${(results.durationMs / 1000).toFixed(2)}s`);

  return results;
}

module.exports = {
  auditLinksFast
};
