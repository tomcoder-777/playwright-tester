/**
 * 🔍 Website Discovery Engine
 * Scans page DOM to build complete inventory of pages, elements, assets, and forms.
 * Instrumented with named operations and execution timing breakdown.
 */
const config = require('./config');
const { classifyElementSafety } = require('./safety_classifier');
const { waitForHydration } = require('./hydration_wait');

// Extracts same-origin, in-scope hrefs from raw HTML via lightweight regex parsing.
// Used for depth-2 crawling without spending a browser navigation per page.
function extractLinksFromHtml(html, baseUrl, targetOrigin) {
  const found = new Set();
  const hrefRegex = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    try {
      const resolved = new URL(raw, baseUrl);
      if (config.discovery.sameDomainOnly && resolved.origin !== targetOrigin) continue;
      resolved.hash = '';
      found.add(resolved.toString());
    } catch (e) {
      // Invalid URL, ignore
    }
  }
  return Array.from(found);
}

// Stage 2 of discovery: expand a sample of already-discovered pages one level deeper
// by fetching their raw HTML (no browser navigation) and extracting further in-scope links.
async function deepCrawlLinks(requestContext, inventory, targetUrl, targetOrigin, traceLogs) {
  const maxPages = config.discovery.maxPagesToCrawl;
  const maxSeeds = config.discovery.maxSeedPagesToExpand || 8;
  const maxDepth = config.discovery.maxCrawlDepth || 2;

  if (maxDepth < 2 || !requestContext) return;
  if (inventory.pages.length >= maxPages) return;

  const knownUrls = new Set(inventory.pages.map(p => p.url));
  knownUrls.add(targetUrl);

  const seeds = inventory.pages.slice(0, maxSeeds);
  let newPagesFound = 0;

  // Fetch all seed pages concurrently (I/O-bound HTTP requests) rather than one at a time —
  // sequential fetches here were the single biggest avoidable contributor to pipeline runtime.
  async function expandSeed(seed) {
    if (inventory.pages.length >= maxPages) return;
    try {
      const response = await requestContext.fetch(seed.url, { method: 'GET', timeout: 5000 });
      if (!response.ok()) return;
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('text/html')) return;

      const html = await response.text();
      const links = extractLinksFromHtml(html, seed.url, targetOrigin);

      for (const link of links) {
        if (knownUrls.has(link)) continue;
        if (inventory.pages.length >= maxPages) break;
        knownUrls.add(link);
        inventory.pages.push({ url: link, text: `Discovered via ${seed.url}`, ariaLabel: '', depth: 2 });
        newPagesFound++;
      }
    } catch (e) {
      // Seed page unreachable during deep crawl; skip silently, link auditor will catch it if truly broken
    }
  }

  await Promise.all(seeds.map(expandSeed));

  traceLogs.push(`Deep Crawl (Depth 2) — expanded ${seeds.length} seed page(s), discovered ${newPagesFound} additional in-scope page(s)`);
}

async function discoverPageInventory(page, targetUrl, requestContext) {
  const discoveryStartTime = Date.now();
  const timings = {};
  const traceLogs = [];

  const inventory = {
    pages: [],
    interactiveElements: [],
    assets: [],
    forms: [],
    nonFunctionalLinks: [],
    timings: timings,
    traceLogs: traceLogs,
    discoveryDurationMs: 0
  };

  try {
    const targetOrigin = new URL(targetUrl).origin;

    // 0. Operation: Wait for client-side hydration before scanning the DOM — otherwise
    // JS-rendered sites (React/Vue/Next.js) get scanned while still an empty shell.
    const tHydrate = Date.now();
    await waitForHydration(page);
    const dHydrate = Date.now() - tHydrate;
    timings['Hydration Wait'] = dHydrate;
    traceLogs.push(`Hydration Wait — waited ${dHydrate}ms for client-side rendered content to appear`);

    // 1. Operation: Discover Links
    // Query ALL anchors, not just a[href] — an <a> with no href attribute (or a bare "#"
    // placeholder) renders as a normal link visually but goes nowhere when clicked. That
    // class of bug is invisible to a selector that requires href to exist, so it's tracked
    // separately below instead of silently disappearing from discovery.
    const t1 = Date.now();
    const rawLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors.map((a, idx) => {
        // Stamped unconditionally (cheap) so any placeholder anchor found below can be
        // re-selected later to test-click it and see whether a JS handler actually does anything.
        a.setAttribute('data-qa-link-idx', String(idx));
        return {
          qaLinkIndex: idx,
          text: a.innerText.trim(),
          hasHref: a.hasAttribute('href'),
          href: a.getAttribute('href'),
          fullUrl: a.href,
          ariaLabel: a.getAttribute('aria-label') || ''
        };
      });
    });

    const uniqueUrls = new Set();
    uniqueUrls.add(targetUrl);

    for (const link of rawLinks) {
      const hrefRaw = (link.href || '').trim().toLowerCase();
      const isPlaceholder = !link.hasHref || hrefRaw === '' || hrefRaw === '#' ||
        hrefRaw === 'javascript:void(0)' || hrefRaw === 'javascript:;';

      if (isPlaceholder) {
        inventory.nonFunctionalLinks.push({
          qaLinkIndex: link.qaLinkIndex,
          text: link.text || link.ariaLabel || '(no visible text)',
          ariaLabel: link.ariaLabel,
          reason: !link.hasHref ? 'Anchor tag has no href attribute' : `Anchor href is a non-navigating placeholder ("${link.href}")`
        });
        continue;
      }

      try {
        if (link.fullUrl.startsWith('javascript:') || link.fullUrl.startsWith('mailto:')) continue;
        const parsed = new URL(link.fullUrl);
        
        // Scope to same origin by default
        if (config.discovery.sameDomainOnly && parsed.origin !== targetOrigin) continue;
        
        // Ignore pure hash anchors
        parsed.hash = '';
        const normalized = parsed.toString();

        if (!uniqueUrls.has(normalized) && uniqueUrls.size < config.discovery.maxPagesToCrawl) {
          uniqueUrls.add(normalized);
          inventory.pages.push({
            url: normalized,
            text: link.text || 'Internal Link',
            ariaLabel: link.ariaLabel
          });
        }
      } catch (e) {
        // Invalid URL ignore
      }
    }
    const d1 = Date.now() - t1;
    timings['Discover Links'] = d1;
    traceLogs.push(`Discover Links — ${rawLinks.length} anchors found, ${inventory.pages.length} unique in-scope links, ${inventory.nonFunctionalLinks.length} non-functional (no destination) — ${d1}ms`);

    // 1b. Operation: Deep Crawl (Depth 2) — expand a sample of discovered pages via HTTP fetch
    const tDeep = Date.now();
    await deepCrawlLinks(requestContext, inventory, targetUrl, targetOrigin, traceLogs);
    timings['Deep Crawl'] = Date.now() - tDeep;

    // 2. Operation: Discover Interactive Elements
    const t2 = Date.now();
    const rawControls = await page.evaluate(() => {
      const selectors = 'button, input, textarea, select, [role="button"], [role="tab"], [role="menuitem"], summary';
      const elements = Array.from(document.querySelectorAll(selectors));

      return elements.map((el, idx) => {
        // Stamp a stable attribute so downstream stages (interaction auditor) can
        // re-select this exact element later without relying on fragile CSS guesses.
        el.setAttribute('data-qa-idx', String(idx));
        return {
          qaIndex: idx,
          tagName: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || el.tagName.toLowerCase(),
          text: el.innerText ? el.innerText.trim().slice(0, 50) : '',
          id: el.id || '',
          name: el.name || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          placeholder: el.getAttribute('placeholder') || '',
          isDisabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
          isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
          isInForm: el.closest('form') !== null
        };
      });
    });

    inventory.interactiveElements = rawControls.map(ctrl => {
      const safety = classifyElementSafety(ctrl);
      return {
        ...ctrl,
        safetyClassification: safety.classification,
        isSafe: safety.isSafe,
        safetyReason: safety.reason
      };
    });
    const d2 = Date.now() - t2;
    timings['Discover Interactive Elements'] = d2;
    traceLogs.push(`Discover Interactive Elements — ${inventory.interactiveElements.length} controls classified — ${d2}ms`);

    // 3. Operation: Discover Images & Assets
    const t3 = Date.now();
    const rawAssets = await page.evaluate(() => {
      const assets = [];

      // Images
      document.querySelectorAll('img').forEach(img => {
        assets.push({
          type: 'image',
          src: img.getAttribute('src') || '',
          fullSrc: img.src || '',
          alt: img.getAttribute('alt'),
          hasAlt: img.hasAttribute('alt')
        });
      });

      // Scripts
      document.querySelectorAll('script[src]').forEach(s => {
        assets.push({ type: 'script', src: s.src });
      });

      // Stylesheets
      document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
        assets.push({ type: 'stylesheet', src: l.href });
      });

      // Iframes
      document.querySelectorAll('iframe').forEach(f => {
        assets.push({ type: 'iframe', src: f.src });
      });

      return assets;
    });

    inventory.assets = rawAssets;
    const d3 = Date.now() - t3;
    timings['Discover Images'] = d3;
    traceLogs.push(`Discover Images — ${rawAssets.length} assets discovered — ${d3}ms`);

    // 4. Operation: Discover Forms
    const t4 = Date.now();
    const rawForms = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map((f, idx) => ({
        index: idx,
        action: f.getAttribute('action') || '',
        method: (f.getAttribute('method') || 'GET').toUpperCase(),
        inputCount: f.querySelectorAll('input, textarea, select').length,
        hasSubmitButton: f.querySelectorAll('button[type="submit"], input[type="submit"]').length > 0
      }));
    });

    inventory.forms = rawForms;
    const d4 = Date.now() - t4;
    timings['Discover Forms'] = d4;
    traceLogs.push(`Discover Forms — ${rawForms.length} forms evaluated — ${d4}ms`);

  } catch (err) {
    console.log(`[DISCOVERY WARN] Error discovering inventory: ${err.message}`);
  }

  inventory.discoveryDurationMs = Date.now() - discoveryStartTime;
  return inventory;
}

module.exports = {
  discoverPageInventory
};
