/**
 * 🛡️ Action Safety Classifier
 * Evaluates elements before interaction to prevent executing destructive actions.
 */
const config = require('./config');

function classifyElementSafety(elementData) {
  const text = (elementData.text || '').toLowerCase().trim();
  const ariaLabel = (elementData.ariaLabel || '').toLowerCase().trim();
  const id = (elementData.id || '').toLowerCase().trim();
  const name = (elementData.name || '').toLowerCase().trim();

  const combinedString = `${text} ${ariaLabel} ${id} ${name}`;

  for (const keyword of config.destructiveKeywords) {
    if (combinedString.includes(keyword)) {
      return {
        isSafe: false,
        classification: 'DESTRUCTIVE',
        reason: `Matches destructive action keyword "${keyword}". Requires explicit user authorization.`
      };
    }
  }

  return {
    isSafe: true,
    classification: 'SAFE',
    reason: 'Standard non-destructive UI element.'
  };
}

module.exports = {
  classifyElementSafety
};
