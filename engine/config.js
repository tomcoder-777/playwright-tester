/**
 * ⚙️ Engine Configuration Settings
 * Enterprise Black-Box QA Platform Config
 */

module.exports = {
  // Navigation & Action Timeouts (in milliseconds)
  timeouts: {
    navigation: 15000,
    commitNavigation: 8000,
    elementVisibility: 5000,
    interaction: 6000,
    networkRequest: 8000
  },

  // Navigation Strategy
  navigationStrategy: {
    waitUntil: 'domcontentloaded',
    fallbackWaitUntil: 'commit'
  },

  // Asset & Link Auditing Performance Options
  assetAuditor: {
    concurrency: 8,
    timeout: 4000,
    fallbackToGet: true
  },

  linkAuditor: {
    concurrency: 8,
    timeout: 5000,
    maxLinksToAudit: 40
  },

  // Performance Budget Alerts (Threshold percentage of total audit runtime)
  performanceBudget: {
    maxPhasePercentage: 40
  },

  // Discovery & Crawl Limits
  discovery: {
    maxCrawlDepth: 2,
    maxPagesToCrawl: 20,
    maxSeedPagesToExpand: 8,
    sameDomainOnly: true
  },

  // Interactive Control Auditing (hover / focus / safe click)
  interactionAuditor: {
    maxElementsToTest: 8,
    hoverDelayMs: 150,
    postClickSettleMs: 300
  },

  // Standard Viewports
  viewports: {
    desktop: { width: 1440, height: 900, name: 'Desktop' },
    mobile: { width: 375, height: 812, name: 'Mobile' }
  },

  // Destructive Action Regex Keywords
  destructiveKeywords: [
    'delete', 'remove', 'destroy', 'cancel account', 'purge',
    'pay', 'checkout', 'buy now', 'purchase', 'subscribe',
    'transfer', 'reset database', 'drop'
  ]
};
