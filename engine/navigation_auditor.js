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
  async function checkLink(item) {
    const linkStart = Date.now();
    const url = item.url;
    results.totalAudited++;

    try {
      const response = await requestContext.fetch(url, {
        method: 'GET',
        maxRedirects: 5,
        timeout: timeout
      });

      const status = response.status();
      const elapsedSec = ((Date.now() - linkStart) / 1000).toFixed(2);
      results.traceLogs.push(`GET "${url}" — status ${status} — ${elapsedSec}s`);

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
    } catch (err) {
      const elapsedSec = ((Date.now() - linkStart) / 1000).toFixed(2);
      results.traceLogs.push(`GET "${url}" — ERROR ${err.message} — ${elapsedSec}s`);
      results.brokenLinks.push({
        url: url,
        status: 0,
        statusText: `Network Connection Error: ${err.message}`,
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
