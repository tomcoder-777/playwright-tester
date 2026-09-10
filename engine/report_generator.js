/**
 * 📊 Standardized QA Report Generator
 * Generates structured executive QA reports with Standardized Issue Cards,
 * Audit Performance Phase Breakdown, Self-Performance Budget Alerts,
 * and Collapsible Technical Execution Trace Details.
 */
const config = require('./config');

function generateQAReport(targetUrl, preflight, inventory = {}, correlation = {}, auditArtifacts = {}) {
  const issues = [];
  const technicalExecutionDetails = [];
  const performanceBudgetAlerts = [];

  // 1. Process Preflight Failures into Standardized Issues
  if (!preflight.success) {
    issues.push({
      issue: 'Primary Endpoint Navigation Failure',
      severity: 'Critical',
      evidence: `Browser-observed HTTP status: ${preflight.httpStatus || '0'}. Navigation duration: ${(preflight.navigationDurationMs / 1000).toFixed(1)}s. ${preflight.errorMessage}`,
      rootCause: `Endpoint failed to respond cleanly within navigation timeout. Error: ${preflight.errorMessage}`,
      affectedArea: targetUrl,
      recommendedAction: 'Verify target web server status, check network routing, and ensure DNS records are properly configured.',
      evidenceFiles: auditArtifacts.screenshots || []
    });
  }

  // 2. Process Failed Requests into Standardized Issues
  if (preflight.failedNetworkRequests && preflight.failedNetworkRequests.length > 0) {
    for (const req of preflight.failedNetworkRequests.slice(0, 5)) {
      issues.push({
        issue: `Failed Network Resource Request (${req.status})`,
        severity: req.status >= 500 ? 'High' : 'Medium',
        evidence: `Browser observed ${req.method} ${req.url} returning HTTP ${req.status} ${req.statusText}`,
        rootCause: req.status >= 500 ? 'Server-side application error' : 'Resource file missing or unaccessible',
        affectedArea: req.url,
        recommendedAction: `Inspect server endpoint handling for ${req.url} and ensure resource permissions are valid.`,
        evidenceFiles: []
      });
    }
  }

  // 3. Process Console & Uncaught JS Exceptions
  if (preflight.uncaughtExceptions && preflight.uncaughtExceptions.length > 0) {
    for (const exc of preflight.uncaughtExceptions.slice(0, 3)) {
      issues.push({
        issue: 'Uncaught JavaScript Runtime Exception',
        severity: 'High',
        evidence: `Uncaught exception in browser runtime: "${exc.message}"`,
        rootCause: 'Frontend application code threw an unhandled JavaScript exception.',
        affectedArea: targetUrl,
        recommendedAction: 'Review browser stack trace, check script scope variables, and wrap fragile DOM queries in safety checks.',
        evidenceFiles: []
      });
    }
  }

  // 4. Process Asset & Image Failures
  if (auditArtifacts.assetAudit && auditArtifacts.assetAudit.brokenImages) {
    for (const img of auditArtifacts.assetAudit.brokenImages) {
      issues.push({
        issue: 'Broken Image Asset',
        severity: 'Medium',
        evidence: `Browser observed broken image tag pointing to: "${img.src}". Details: ${img.details}`,
        rootCause: 'Image file is missing, path is malformed, or server returned HTTP 404/500.',
        affectedArea: img.src,
        recommendedAction: 'Verify image file exists on origin server and update <img src="..."> path.',
        evidenceFiles: []
      });
    }
  }

  // 4b. Process Missing Alt Text (Accessibility)
  if (auditArtifacts.assetAudit && auditArtifacts.assetAudit.missingAltAccessibilityIssues) {
    for (const alt of auditArtifacts.assetAudit.missingAltAccessibilityIssues.slice(0, 10)) {
      issues.push({
        issue: 'Image Missing Alt Text',
        severity: 'Low',
        evidence: `Image "${alt.src}" has no alt attribute.`,
        rootCause: alt.details,
        affectedArea: alt.src,
        recommendedAction: 'Add a descriptive alt="..." attribute (or alt="" if purely decorative) for screen reader compatibility (WCAG 1.1.1).',
        evidenceFiles: []
      });
    }
  }

  // 4c. Process Broken Links (Navigation Audit)
  if (auditArtifacts.linkAudit && auditArtifacts.linkAudit.brokenLinks) {
    for (const link of auditArtifacts.linkAudit.brokenLinks.slice(0, 10)) {
      issues.push({
        issue: `Broken Link (HTTP ${link.status || 0})`,
        severity: link.status === 0 ? 'High' : (link.status >= 500 ? 'High' : 'Medium'),
        evidence: `Link "${link.anchorText || link.url}" resolved to "${link.url}" returning ${link.status === 0 ? link.statusText : `HTTP ${link.status} ${link.statusText}`}.`,
        rootCause: link.status === 0 ? 'Network/DNS failure resolving the link target.' : (link.status >= 500 ? 'Server-side error on the linked page.' : 'Linked page missing, moved, or access-restricted.'),
        affectedArea: link.url,
        recommendedAction: 'Verify the link target exists, update or remove the stale href, and confirm server routing for this path.',
        evidenceFiles: []
      });
    }
  }

  // 4c-ii. Process Access-Restricted Links (401/403 — informational, not broken)
  if (auditArtifacts.linkAudit && auditArtifacts.linkAudit.restrictedLinks) {
    for (const link of auditArtifacts.linkAudit.restrictedLinks.slice(0, 10)) {
      issues.push({
        issue: `Access-Restricted Link (HTTP ${link.status})`,
        severity: 'Low',
        evidence: `Link "${link.anchorText || link.url}" resolved to "${link.url}" returning HTTP ${link.status} ${link.statusText}.`,
        rootCause: 'Page requires authentication/authorization; not a broken link, but unauthenticated crawlers and users without credentials cannot reach it.',
        affectedArea: link.url,
        recommendedAction: 'Confirm this restriction is intentional. If the page should be publicly reachable, review server auth configuration.',
        evidenceFiles: []
      });
    }
  }

  // 4d. Process Missing Form Labels (Accessibility)
  if (auditArtifacts.formAudit && auditArtifacts.formAudit.missingLabels) {
    for (const field of auditArtifacts.formAudit.missingLabels.slice(0, 10)) {
      issues.push({
        issue: 'Form Input Missing Label',
        severity: 'Low',
        evidence: `${field.element}${field.id ? ` id="${field.id}"` : ''}${field.name ? ` name="${field.name}"` : ''} has no accessible label.`,
        rootCause: field.details,
        affectedArea: targetUrl,
        recommendedAction: 'Associate the input with a <label for="...">, or add an aria-label/aria-labelledby attribute.',
        evidenceFiles: []
      });
    }
  }

  // 4e. Process Interaction-Triggered Runtime Errors
  if (auditArtifacts.interactionAudit && auditArtifacts.interactionAudit.errorsTriggered) {
    for (const err of auditArtifacts.interactionAudit.errorsTriggered) {
      issues.push({
        issue: 'JavaScript Error Triggered by User Interaction',
        severity: 'High',
        evidence: `Interacting with control "${err.element}" (${err.selector}) produced: ${err.details}`,
        rootCause: 'Frontend event handler threw an unhandled exception or triggered a failed network request during interaction.',
        affectedArea: targetUrl,
        recommendedAction: 'Reproduce the interaction manually, inspect the event handler for this control, and add error handling around the failing code path.',
        evidenceFiles: []
      });
    }
  }

  // 5. Process Layout Overflow Issues
  if (auditArtifacts.responsiveAudit && auditArtifacts.responsiveAudit.layoutIssues) {
    for (const layout of auditArtifacts.responsiveAudit.layoutIssues) {
      issues.push({
        issue: `${layout.issue} (${layout.viewport})`,
        severity: 'Low',
        evidence: layout.details,
        rootCause: 'CSS layout element width exceeds viewport dimensions without overflow containment.',
        affectedArea: targetUrl,
        recommendedAction: 'Add `max-width: 100%` or `overflow-x: hidden` to container CSS rules.',
        evidenceFiles: auditArtifacts.screenshots || []
      });
    }
  }

  // --- Collect Technical Execution Trace Logs ---
  if (preflight.operationName) {
    technicalExecutionDetails.push({
      operation: preflight.operationName,
      trace: `Homepage Navigation completed in ${(preflight.navigationDurationMs / 1000).toFixed(1)}s (HTTP ${preflight.httpStatus || 0})`
    });
  }

  if (inventory.traceLogs) {
    inventory.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Discovery Engine', trace: t }));
  }

  if (auditArtifacts.linkAudit && auditArtifacts.linkAudit.traceLogs) {
    auditArtifacts.linkAudit.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Validate Internal Links', trace: t }));
  }

  if (auditArtifacts.assetAudit && auditArtifacts.assetAudit.traceLogs) {
    auditArtifacts.assetAudit.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Validate Image Assets', trace: t }));
  }

  if (auditArtifacts.formAudit && auditArtifacts.formAudit.traceLogs) {
    auditArtifacts.formAudit.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Test Forms', trace: t }));
  }

  if (auditArtifacts.interactionAudit && auditArtifacts.interactionAudit.traceLogs) {
    auditArtifacts.interactionAudit.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Test Interactive Controls', trace: t }));
  }

  if (auditArtifacts.responsiveAudit && auditArtifacts.responsiveAudit.traceLogs) {
    auditArtifacts.responsiveAudit.traceLogs.forEach(t => technicalExecutionDetails.push({ operation: 'Viewport & Responsive Layout', trace: t }));
  }

  // --- Compute Performance Breakdown ---
  const preflightMs = preflight.navigationDurationMs || 0;
  const discoveryMs = inventory.discoveryDurationMs || 0;
  const linkAuditMs = (auditArtifacts.linkAudit && auditArtifacts.linkAudit.durationMs) || 0;
  const assetAuditMs = (auditArtifacts.assetAudit && auditArtifacts.assetAudit.durationMs) || 0;
  const formAuditMs = (auditArtifacts.formAudit && auditArtifacts.formAudit.durationMs) || 0;
  const interactionAuditMs = (auditArtifacts.interactionAudit && auditArtifacts.interactionAudit.durationMs) || 0;
  const responsiveAuditMs = (auditArtifacts.responsiveAudit && auditArtifacts.responsiveAudit.durationMs) || 0;
  const cleanupMs = (auditArtifacts.timings && auditArtifacts.timings.cleanupMs) || 150;

  const totalRuntimeMs = auditArtifacts.totalRuntimeMs || (preflightMs + discoveryMs + linkAuditMs + assetAuditMs + formAuditMs + interactionAuditMs + responsiveAuditMs + cleanupMs);

  function calcPhase(name, durationMs) {
    const pct = totalRuntimeMs > 0 ? parseFloat(((durationMs / totalRuntimeMs) * 100).toFixed(1)) : 0;
    return {
      phaseName: name,
      durationMs: durationMs,
      durationSec: `${(durationMs / 1000).toFixed(2)}s`,
      percentage: pct
    };
  }

  const performanceBreakdown = [
    calcPhase('Preflight (Homepage Navigation)', preflightMs),
    calcPhase('Discovery Engine', discoveryMs),
    calcPhase('Navigation Audit (Validate Internal Links)', linkAuditMs),
    calcPhase('Asset Audit (Validate Image Assets)', assetAuditMs),
    calcPhase('Form Audit (Test Forms / Inputs)', formAuditMs),
    calcPhase('Interaction Audit (Hover / Focus / Click)', interactionAuditMs),
    calcPhase('Responsive Audit (Viewport Layout)', responsiveAuditMs),
    calcPhase('Cleanup', cleanupMs)
  ];

  // Self-Performance Budget Evaluation (>40% warning threshold)
  const maxThresholdPct = (config.performanceBudget && config.performanceBudget.maxPhasePercentage) || 40;
  performanceBreakdown.forEach(phase => {
    if (phase.percentage > maxThresholdPct && phase.durationMs > 1000) {
      performanceBudgetAlerts.push({
        phaseName: phase.phaseName,
        percentage: phase.percentage,
        durationSec: phase.durationSec,
        message: `${phase.phaseName} consumed ${phase.percentage}% of total audit runtime (budget limit: ${maxThresholdPct}%).`
      });
    }
  });

  // Count Statistics
  const testResults = (correlation && correlation.testResults) || [];
  const testsExecuted = testResults.length;
  const passedCount = testResults.filter(t => t.status === 'PASS').length;
  const failedCount = testResults.filter(t => t.status === 'FAIL').length;
  const blockedCount = testResults.filter(t => t.status === 'BLOCKED').length;
  const skippedCount = testResults.filter(t => t.status === 'SKIPPED').length;

  return {
    targetUrl: targetUrl,
    finalUrl: preflight.finalUrl,
    timestamp: new Date().toISOString(),
    overallStatus: (correlation && correlation.overallStatus) || (preflight.success ? 'PASS' : 'FAIL'),
    summary: {
      pagesTested: (inventory.pages ? inventory.pages.length : 0) + 1,
      testsExecuted: testsExecuted,
      passed: passedCount,
      failed: failedCount,
      blocked: blockedCount,
      skipped: skippedCount
    },
    rootCauseSummary: (correlation && correlation.rootCauseSummary) || (failedCount === 0 ? 'No critical root causes detected.' : 'Application issues detected.'),
    issues: issues,
    blockedTests: testResults.filter(t => t.status === 'BLOCKED'),
    performance: {
      navigationDurationMs: preflight.navigationDurationMs,
      navigationDurationSec: preflight.navigationDurationSec || `${((preflight.navigationDurationMs || 0) / 1000).toFixed(1)}s`,
      domContentLoadedMs: preflight.domContentLoadedMs,
      loadTimingMs: preflight.loadTimingMs,
      totalRuntimeMs: totalRuntimeMs,
      totalRuntimeSec: `${(totalRuntimeMs / 1000).toFixed(2)}s`,
      breakdown: performanceBreakdown,
      budgetAlerts: performanceBudgetAlerts,
      label: 'Browser-observed performance metrics'
    },
    technicalExecutionDetails: technicalExecutionDetails,
    accessibilityObservations: auditArtifacts.accessibilityObservations || [],
    interactionAudit: auditArtifacts.interactionAudit ? {
      elementsDiscovered: auditArtifacts.interactionAudit.elementsDiscovered,
      elementsTested: auditArtifacts.interactionAudit.elementsTested,
      clicked: auditArtifacts.interactionAudit.clicked,
      hoveredOnly: auditArtifacts.interactionAudit.hoveredOnly,
      skippedUnsafe: auditArtifacts.interactionAudit.skippedUnsafe,
      errorsTriggered: auditArtifacts.interactionAudit.errorsTriggered.length
    } : null,
    artifacts: {
      screenshots: auditArtifacts.screenshots || [],
      videos: auditArtifacts.videos || [],
      reportUrl: '/report/index.html'
    }
  };
}

module.exports = {
  generateQAReport
};
