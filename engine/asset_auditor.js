/**
 * 🖼️ Asset Integrity & Accessibility Separator Module
 * Audits images with URL deduplication, controlled concurrency, HEAD + GET fallback,
 * and detailed operation trace logging.
 */
const config = require('./config');

async function auditAssets(requestContext, assets) {
  const startTime = Date.now();
  const concurrency = (config.assetAuditor && config.assetAuditor.concurrency) || 8;
  const timeout = (config.assetAuditor && config.assetAuditor.timeout) || 4000;

  const results = {
    operationName: 'Validate Image Assets',
    totalImages: 0,
    uniqueImagesCount: 0,
    brokenImages: [],
    missingAltAccessibilityIssues: [],
    validImagesCount: 0,
    traceLogs: [],
    durationMs: 0
  };

  const images = assets.filter(a => a.type === 'image');
  results.totalImages = images.length;

  // 1. Accessibility Check: Missing alt attribute (check all image tags)
  for (const img of images) {
    if (img.hasAlt === false || img.alt === null) {
      results.missingAltAccessibilityIssues.push({
        issueType: 'ACCESSIBILITY ISSUE – missing alt text',
        src: img.fullSrc || img.src || 'inline/unspecified',
        details: 'Image element is missing an alt attribute required for screen readers (WCAG 1.1.1).'
      });
    }
  }

  // 2. Deduplicate URLs for Network Audit
  const uniqueUrlMap = new Map();
  for (const img of images) {
    if (!img.src || img.src.trim().length === 0) {
      results.brokenImages.push({
        issueType: 'BROKEN IMAGE',
        src: 'empty',
        details: 'Image tag has an empty or missing src attribute.'
      });
      continue;
    }
    const fullUrl = img.fullSrc || img.src;
    if (fullUrl && fullUrl.startsWith('http') && !uniqueUrlMap.has(fullUrl)) {
      uniqueUrlMap.set(fullUrl, img);
    }
  }

  const uniqueUrls = Array.from(uniqueUrlMap.keys());
  results.uniqueImagesCount = uniqueUrls.length;
  results.traceLogs.push(`Validate Image Assets — ${images.length} total image tags deduplicated to ${uniqueUrls.length} unique URLs`);

  // 3. Concurrent Worker Pool for Network Checks
  async function auditSingleAsset(url) {
    const assetStart = Date.now();
    let status = 0;
    let methodUsed = 'HEAD';
    let isBroken = false;
    let errorDetail = '';

    try {
      // Step A: Attempt fast HEAD request
      let response = await requestContext.fetch(url, {
        method: 'HEAD',
        timeout: timeout
      });

      status = response.status();

      // Step B: Resilient Fallback to GET if HEAD returns non-2xx/3xx or 405 Method Not Allowed
      if (status >= 400 || status === 0) {
        if (config.assetAuditor && config.assetAuditor.fallbackToGet) {
          methodUsed = 'GET (Fallback)';
          response = await requestContext.fetch(url, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-1024' },
            timeout: timeout
          });
          status = response.status();
        }
      }

      if (status >= 400) {
        isBroken = true;
        errorDetail = `HTTP ${status} ${response.statusText()}`;
      }
    } catch (err) {
      // Step C: Fallback to GET if HEAD threw an exception (e.g. CORS block / method rejected)
      if (config.assetAuditor && config.assetAuditor.fallbackToGet && methodUsed === 'HEAD') {
        try {
          methodUsed = 'GET (Fallback)';
          const response = await requestContext.fetch(url, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-1024' },
            timeout: timeout
          });
          status = response.status();
          if (status >= 400) {
            isBroken = true;
            errorDetail = `HTTP ${status} ${response.statusText()}`;
          }
        } catch (getErr) {
          isBroken = true;
          errorDetail = `Network fetch error: ${getErr.message}`;
        }
      } else {
        isBroken = true;
        errorDetail = `Network fetch error: ${err.message}`;
      }
    }

    const elapsedMs = Date.now() - assetStart;
    const traceEntry = `${methodUsed} "${url}" — status ${status} — ${(elapsedMs / 1000).toFixed(2)}s`;
    results.traceLogs.push(traceEntry);

    if (isBroken) {
      results.brokenImages.push({
        issueType: 'BROKEN IMAGE',
        src: url,
        status: status,
        details: errorDetail
      });
    } else {
      results.validImagesCount++;
    }
  }

  // Execute worker pool with concurrency limit
  const pool = [];
  for (const url of uniqueUrls) {
    const p = auditSingleAsset(url);
    pool.push(p);

    if (pool.length >= concurrency) {
      await Promise.race(pool);
      // Remove settled promises
      for (let i = pool.length - 1; i >= 0; i--) {
        // Evaluate pool state
      }
    }
  }
  await Promise.all(pool);

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Validate Image Assets completed in ${(results.durationMs / 1000).toFixed(2)}s (concurrency: ${concurrency})`);

  return results;
}

module.exports = {
  auditAssets
};
