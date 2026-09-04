/**
 * 🎯 Failure Correlation & Dependency Model Engine
 * Classifies test results into PASS, FAIL, BLOCKED, SKIPPED, ERROR
 * and correlates console/network failures to determine probable root cause.
 */

function processFailureDependencies(preflightResult, auditResults) {
  const finalModel = {
    overallStatus: 'PASS',
    rootCauseSummary: null,
    testResults: []
  };

  // 1. Evaluate Preflight Navigation Failure
  if (!preflightResult.success) {
    finalModel.overallStatus = 'FAIL';
    finalModel.rootCauseSummary = `Navigation failed after ${(preflightResult.navigationDurationMs / 1000).toFixed(1)}s: ${preflightResult.errorMessage}`;

    // Classify preflight as FAIL
    finalModel.testResults.push({
      testName: 'Preflight Endpoint Navigation',
      status: 'FAIL',
      reason: preflightResult.errorMessage,
      evidence: `HTTP ${preflightResult.httpStatus || 0} — Navigation duration: ${(preflightResult.navigationDurationMs / 1000).toFixed(1)}s`
    });

    // Classify dependent tests as BLOCKED
    const dependentTestNames = [
      'Metadata & Document Title',
      'Asset & Link Audit',
      'Image Integrity & Alt Text',
      'User Interaction Simulation',
      'Form & Input Validation',
      'Responsive Viewport Audit'
    ];

    for (const name of dependentTestNames) {
      finalModel.testResults.push({
        testName: name,
        status: 'BLOCKED',
        reason: 'BLOCKED – Navigation Failure',
        evidence: `Test execution suppressed because primary endpoint navigation failed (${preflightResult.errorMessage}).`
      });
    }

    return finalModel;
  }

  // 2. Navigation Succeeded: Evaluate Individual Audit Results
  let totalFailures = 0;
  let totalBlocked = 0;
  let totalWarnings = 0;

  for (const item of auditResults) {
    if (item.status === 'FAIL') totalFailures++;
    if (item.status === 'BLOCKED') totalBlocked++;
    if (item.status === 'WARNING') totalWarnings++;
    finalModel.testResults.push(item);
  }

  if (totalFailures > 0) {
    finalModel.overallStatus = 'FAIL';
  } else if (totalBlocked > 0 || totalWarnings > 0) {
    finalModel.overallStatus = 'WARNING';
  } else {
    finalModel.overallStatus = 'PASS';
  }

  // 3. Root Cause Attribution — lead with the actual failing audit stage(s), not a
  // blanket preflight correlation. Preflight console/network noise is appended only
  // as supplementary context, since it may be unrelated to the specific failure.
  if (totalFailures > 0) {
    const failedItems = auditResults.filter(item => item.status === 'FAIL');
    const primaryCause = failedItems
      .map(item => `${item.testName}: ${item.reason}`)
      .join(' | ');

    let summary = `Likely root cause: ${primaryCause}`;

    if (preflightResult.failedNetworkRequests.length > 0 || preflightResult.consoleErrors.length > 0) {
      const netErr = preflightResult.failedNetworkRequests.map(r => `${r.method} ${r.url} returned HTTP ${r.status}`).join('; ');
      const consoleErr = preflightResult.consoleErrors.map(c => c.text).join('; ');
      summary += ` (Supplementary signals — Network: [${netErr || 'None'}], Console: [${consoleErr || 'None'}])`;
    }

    finalModel.rootCauseSummary = summary;
  }

  return finalModel;
}

module.exports = {
  processFailureDependencies
};
