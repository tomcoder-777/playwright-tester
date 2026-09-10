const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const config = require('../engine/config');
const { runPreflight } = require('../engine/preflight');
const { discoverPageInventory } = require('../engine/discovery');
const { auditLinksFast } = require('../engine/navigation_auditor');
const { auditAssets } = require('../engine/asset_auditor');
const { auditForms } = require('../engine/form_auditor');
const { auditInteractions } = require('../engine/interaction_auditor');
const { auditResponsiveLayout } = require('../engine/responsive_auditor');
const ConsoleNetworkMonitor = require('../engine/console_network_monitor');
const { auditAccessibility } = require('../engine/accessibility_auditor');
const { processFailureDependencies } = require('../engine/failure_correlator');
const { generateQAReport } = require('../engine/report_generator');

test.describe('Black-Box Website QA Engine', () => {

  test('Execute Complete Black-Box QA Audit Pipeline', async ({ page, request, baseURL }) => {
    const pipelineStartTime = Date.now();
    const targetUrl = process.env.TARGET_URL || baseURL || 'https://example.com';
    console.log(`[INFO] Starting Black-Box QA Pipeline for Target Endpoint: ${targetUrl}`);

    const monitor = new ConsoleNetworkMonitor();
    monitor.attach(page);

    // Stage 1: Preflight
    const preflight = await runPreflight(page, targetUrl);
    console.log(`[PREFLIGHT] Status: ${preflight.httpStatus || 0}, Navigation: ${preflight.navigationDurationSec}, Success: ${preflight.success}`);

    const auditResults = [];
    let inventory = { pages: [], interactiveElements: [], assets: [], forms: [] };
    let linkAudit = {};
    let assetAuditResult = {};
    let formAuditResult = {};
    let interactionAuditResult = {};
    let responsiveAuditResult = {};
    let accessibilityObservations = [];

    // Stage 2: Failure Dependency Check
    if (!preflight.success) {
      console.log(`[PIPELINE WARN] Preflight failed. Suppressing dependent tests to prevent cascading false failures.`);
      
      const correlation = processFailureDependencies(preflight, auditResults);
      const qaReport = generateQAReport(targetUrl, preflight, inventory, correlation, {
        totalRuntimeMs: Date.now() - pipelineStartTime
      });

      // Write JSON Report Artifact
      const snapshotDir = path.join(__dirname, '..', 'snapshots');
      if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, 'qa_report.json'), JSON.stringify(qaReport, null, 2));

      expect(preflight.success, `Preflight Navigation Failed: ${preflight.errorMessage}`).toBe(true);
      return;
    }

    // Stage 3: Discovery & Inventory
    inventory = await discoverPageInventory(page, targetUrl, request);
    console.log(`[DISCOVERY] Found ${inventory.pages.length} reachable pages, ${inventory.interactiveElements.length} controls, ${inventory.assets.length} assets, ${inventory.forms.length} forms in ${inventory.discoveryDurationMs}ms`);

    // Stage 4: Navigation Link Audit (Fast HTTP with Deduplication & Concurrency)
    linkAudit = await auditLinksFast(request, inventory.pages, targetUrl);
    if (linkAudit.brokenLinks.length > 0) {
      auditResults.push({
        testName: 'Asset & Link Audit',
        status: 'FAIL',
        reason: `Detected ${linkAudit.brokenLinks.length} broken link(s)`,
        evidence: linkAudit.brokenLinks.map(b => `${b.url} (HTTP ${b.status})`).join('; ')
      });
    } else if (linkAudit.restrictedLinks.length > 0) {
      auditResults.push({
        testName: 'Asset & Link Audit',
        status: 'WARNING',
        reason: `Detected ${linkAudit.restrictedLinks.length} access-restricted link(s) (HTTP 401/403)`,
        evidence: linkAudit.restrictedLinks.map(b => `${b.url} (HTTP ${b.status})`).join('; ')
      });
    } else {
      auditResults.push({
        testName: 'Asset & Link Audit',
        status: 'PASS',
        reason: 'All sampled internal/external links returned valid HTTP responses',
        evidence: `Audited ${linkAudit.totalAudited} links cleanly in ${(linkAudit.durationMs / 1000).toFixed(2)}s.`
      });
    }

    // Stage 5: Asset Integrity & Accessibility Separator (Deduplicated & Concurrent)
    assetAuditResult = await auditAssets(request, inventory.assets);
    if (assetAuditResult.brokenImages.length > 0) {
      auditResults.push({
        testName: 'Image Integrity',
        status: 'FAIL',
        reason: `Detected ${assetAuditResult.brokenImages.length} broken image asset(s)`,
        evidence: assetAuditResult.brokenImages.map(img => `${img.src} (${img.details})`).join('; ')
      });
    } else {
      auditResults.push({
        testName: 'Image Integrity',
        status: 'PASS',
        reason: 'Image assets returned valid source responses',
        evidence: `Audited ${assetAuditResult.totalImages} images in ${(assetAuditResult.durationMs / 1000).toFixed(2)}s.`
      });
    }

    // Stage 6: Form & Input Validation
    formAuditResult = await auditForms(page, inventory.forms, inventory.interactiveElements);
    if (formAuditResult.missingLabels.length > 0) {
      auditResults.push({
        testName: 'Form & Input Validation',
        status: 'WARNING',
        reason: `Detected ${formAuditResult.missingLabels.length} form input(s) missing explicit labels`,
        evidence: formAuditResult.missingLabels.map(l => l.details).join('; ')
      });
    } else {
      auditResults.push({
        testName: 'Form & Input Validation',
        status: 'PASS',
        reason: 'Form controls verified with valid placeholders/labels',
        evidence: `Audited ${formAuditResult.inputsAudited} input elements.`
      });
    }

    // Stage 6.5: Interactive Control Audit (hover, focus, safe click)
    interactionAuditResult = await auditInteractions(page, inventory.interactiveElements, monitor);
    if (interactionAuditResult.errorsTriggered.length > 0) {
      auditResults.push({
        testName: 'User Interaction Audit',
        status: 'FAIL',
        reason: `${interactionAuditResult.errorsTriggered.length} control interaction(s) triggered JavaScript errors`,
        evidence: interactionAuditResult.errorsTriggered.map(e => `${e.element}: ${e.details}`).join('; ')
      });
    } else {
      auditResults.push({
        testName: 'User Interaction Audit',
        status: 'PASS',
        reason: 'Interactive controls responded to hover, focus, and safe click events without errors',
        evidence: `Tested ${interactionAuditResult.elementsTested} of ${interactionAuditResult.elementsDiscovered} eligible control(s) (${interactionAuditResult.clicked} clicked, ${interactionAuditResult.hoveredOnly} hover/focus-only, ${interactionAuditResult.skippedUnsafe} skipped as destructive).`
      });
    }

    // Stage 7: Responsive Layout Audit (1440px & 375px)
    responsiveAuditResult = await auditResponsiveLayout(page, targetUrl);
    if (responsiveAuditResult.layoutIssues.length > 0) {
      auditResults.push({
        testName: 'Responsive Viewport Audit',
        status: 'FAIL',
        reason: `Detected ${responsiveAuditResult.layoutIssues.length} viewport layout issue(s)`,
        evidence: responsiveAuditResult.layoutIssues.map(l => `${l.viewport}: ${l.details}`).join('; ')
      });
    } else {
      auditResults.push({
        testName: 'Responsive Viewport Audit',
        status: 'PASS',
        reason: 'No horizontal overflow detected on Desktop (1440px) or Mobile (375px) viewports',
        evidence: 'Layout containment verified.'
      });
    }

    // Stage 8: Automated Accessibility Observations
    accessibilityObservations = await auditAccessibility(page);

    // Stage 9: Failure Correlation & QA Report Generation
    const correlation = processFailureDependencies(preflight, auditResults);
    
    // Collect screenshots
    const snapshotDir = path.join(__dirname, '..', 'snapshots');
    let screenshots = [];
    if (fs.existsSync(snapshotDir)) {
      screenshots = fs.readdirSync(snapshotDir)
        .filter(f => f.endsWith('.png'))
        .map(f => `/snapshots/${f}`);
    }

    const totalRuntimeMs = Date.now() - pipelineStartTime;

    const qaReport = generateQAReport(targetUrl, preflight, inventory, correlation, {
      linkAudit: linkAudit,
      assetAudit: assetAuditResult,
      formAudit: formAuditResult,
      interactionAudit: interactionAuditResult,
      responsiveAudit: responsiveAuditResult,
      accessibilityObservations: accessibilityObservations,
      screenshots: screenshots,
      totalRuntimeMs: totalRuntimeMs
    });

    // Write QA Report Artifact
    fs.writeFileSync(path.join(snapshotDir, 'qa_report.json'), JSON.stringify(qaReport, null, 2));
    console.log(`[INFO] Black-Box QA Audit Completed in ${(totalRuntimeMs / 1000).toFixed(2)}s. Overall Status: ${qaReport.overallStatus}`);

    expect(qaReport.overallStatus, `QA Audit finished with status: ${qaReport.overallStatus}`).not.toBe('FAIL');
  });

});
