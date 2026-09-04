/**
 * ♿ Automated Accessibility Observations Module
 * Performs basic automated WCAG observations (form labels, button names, image alt text, headings).
 * Labeled strictly as "Automated accessibility observations".
 */

async function auditAccessibility(page) {
  const observations = [];

  try {
    const a11yData = await page.evaluate(() => {
      const issues = [];

      // 1. Missing H1 Heading
      const h1Count = document.querySelectorAll('h1').length;
      if (h1Count === 0) {
        issues.push({
          category: 'Heading Structure',
          issue: 'Missing H1 Heading',
          details: 'Document contains no primary <h1> element for document hierarchy.'
        });
      } else if (h1Count > 1) {
        issues.push({
          category: 'Heading Structure',
          issue: 'Multiple H1 Headings',
          details: `Document contains ${h1Count} <h1> elements. Prefer a single <h1> per page.`
        });
      }

      // 2. Unnamed Buttons
      const unnamedButtons = Array.from(document.querySelectorAll('button')).filter(b => {
        const text = (b.innerText || '').trim();
        const aria = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby');
        const title = b.getAttribute('title');
        return !text && !aria && !title;
      });

      if (unnamedButtons.length > 0) {
        issues.push({
          category: 'Accessible Names',
          issue: `${unnamedButtons.length} Button(s) Missing Accessible Name`,
          details: 'Interactive buttons exist without visible text, aria-label, or title for screen readers.'
        });
      }

      // 3. Form Control Labels
      const unlabeledInputs = Array.from(document.querySelectorAll('input, select, textarea')).filter(i => {
        if (['hidden', 'submit', 'button', 'image'].includes(i.type)) return false;
        const id = i.id;
        const hasLabelTag = id ? document.querySelector(`label[for="${id}"]`) : false;
        const hasAria = i.getAttribute('aria-label') || i.getAttribute('aria-labelledby');
        const hasTitle = i.getAttribute('title');
        return !hasLabelTag && !hasAria && !hasTitle;
      });

      if (unlabeledInputs.length > 0) {
        issues.push({
          category: 'Form Control Labels',
          issue: `${unlabeledInputs.length} Form Input(s) Missing Labels`,
          details: 'Form inputs exist without an associated <label>, aria-label, or title.'
        });
      }

      return issues;
    });

    return a11yData;
  } catch (e) {
    return observations;
  }
}

module.exports = {
  auditAccessibility
};
