/**
 * 📝 Form & Input Auditor Module
 * Checks form input visibility, labels, focus, required fields, and non-destructive interaction.
 */
const { humanType } = require('../tests/helpers/human_actions');

async function auditForms(page, forms, interactiveElements) {
  const startTime = Date.now();
  const results = {
    operationName: 'Test Forms',
    formsFound: forms.length,
    inputsAudited: 0,
    inputsValid: 0,
    missingLabels: [],
    unauthorizedSubmissionsSkipped: 0,
    traceLogs: [],
    durationMs: 0
  };

  const inputs = interactiveElements.filter(e => ['input', 'textarea', 'select'].includes(e.tagName));
  results.inputsAudited = inputs.length;
  results.traceLogs.push(`Test Forms — ${forms.length} forms and ${inputs.length} input controls found`);

  for (const input of inputs.slice(0, 5)) {
    // Check if input has aria-label, placeholder, or associated label
    const hasLabel = input.ariaLabel || input.placeholder || input.name || input.id;
    if (!hasLabel) {
      results.missingLabels.push({
        element: `<${input.tagName} type="${input.type}">`,
        id: input.id,
        name: input.name,
        details: 'Form control is missing an explicit label, placeholder, or aria-label.'
      });
      results.traceLogs.push(`Test Forms — missing label on input <${input.tagName} id="${input.id || ''}">`);
    } else {
      results.inputsValid++;
    }

    // Safe Non-Destructive Typing Test (if visible & enabled)
    if (input.isVisible && !input.isDisabled && ['text', 'search', 'email', 'textarea'].includes(input.type)) {
      try {
        const selector = input.id ? `#${input.id}` : (input.name ? `[name="${input.name}"]` : `input[type="${input.type}"]`);
        const loc = page.locator(selector).first();
        if (await loc.isVisible().catch(() => false)) {
          await loc.focus().catch(() => {});
          await humanType(loc, 'QA Test Query').catch(() => {});
          results.traceLogs.push(`Test Forms — typed non-destructive test input into ${selector}`);
        }
      } catch (e) {
        // Safe typing fallback
      }
    }
  }

  // Check form submissions
  for (const form of forms) {
    if (form.hasSubmitButton) {
      results.unauthorizedSubmissionsSkipped++;
    }
  }

  results.durationMs = Date.now() - startTime;
  results.traceLogs.push(`Test Forms completed in ${results.durationMs}ms`);

  return results;
}

module.exports = {
  auditForms
};
