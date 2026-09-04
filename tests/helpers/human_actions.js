/**
 * 🤖 PlayBot Human-Like Interaction Helpers
 * Makes Playwright behave like a real human user browsing a website.
 */

// Helper 1: Type text like a real human with natural keystroke delays
async function humanType(locator, text) {
  await locator.focus();
  for (const char of text) {
    await locator.press(char);
    // Random delay between 40ms and 120ms per keystroke
    const delay = Math.floor(Math.random() * 80) + 40;
    await new Promise(r => setTimeout(r, delay));
  }
}

// Helper 2: Hover over an element before clicking (like a human moving a mouse)
async function humanClick(locator) {
  await locator.hover();
  await new Promise(r => setTimeout(r, 200 + Math.random() * 150)); // Short pause before click
  await locator.click();
}

// Helper 3: Smooth scroll down page like a human reading content
async function humanScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight / 2) { // scroll halfway down
          clearInterval(timer);
          resolve();
        }
      }, 80);
    });
  });
  // Pause at bottom before continuing
  await page.waitForTimeout(500);
}

module.exports = {
  humanType,
  humanClick,
  humanScroll
};
