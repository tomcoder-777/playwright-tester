/**
 * 🗣️ Plain-Language Issue Translator
 * Every finding also gets a short, non-technical explanation: what's wrong, why it matters
 * to a real visitor, and what to do about it — written for someone with no coding background.
 * The technical fields (severity, evidence, root cause) stay on the issue too, for anyone
 * who wants to hand this to a developer.
 */

const TEMPLATES = {
  navigation_failure: {
    summary: () => `We couldn't open your website at all during the test.`,
    whyItMatters: () => `If real visitors run into this too, they can't reach your site — this is the most serious kind of problem a website can have.`,
    whatToDo: () => `Try opening the site yourself right now. If it loads fine for you, the problem may have been temporary (a busy server, or an unstable internet connection during the test) — try testing again in a few minutes. If it still won't load, your hosting needs attention right away.`
  },
  navigation_failure_uncertain: {
    summary: () => `We couldn't open your website during the test, but we're not fully sure why.`,
    whyItMatters: () => `This could mean your site is genuinely down — or it could just mean the internet connection running this test was unstable. We tried twice before giving up, and it failed both times, so it's worth a second look either way.`,
    whatToDo: () => `Open the site yourself in a browser right now. If it loads fine, re-run this test — likely just a connection blip. If it doesn't load for you either, your hosting needs attention.`
  },
  dns_failure: {
    summary: () => `Your website's address couldn't be found at all — it's as if the domain doesn't exist.`,
    whyItMatters: () => `No one can reach your site right now, from anywhere.`,
    whatToDo: () => `Check your domain registration and DNS settings — this usually means the domain has expired or its DNS records are misconfigured.`
  },
  broken_link: {
    summary: (i) => `A link on your site${i.linkLabel ? ` ("${i.linkLabel}")` : ''} doesn't work — clicking it leads to an error page instead of where it should go.`,
    whyItMatters: () => `Visitors who click this link hit a dead end, which looks unprofessional and can lose you their trust (and business).`,
    whatToDo: () => `Update the link to point to the correct page, or remove it if that page no longer exists.`
  },
  unverifiable_link: {
    summary: (i) => `We couldn't confirm whether a link${i.linkLabel ? ` ("${i.linkLabel}")` : ''} works — the connection kept failing during testing, even after trying twice.`,
    whyItMatters: () => `This is often caused by a slow or unstable internet connection during the test itself, rather than a real problem with your site — but we can't be certain either way.`,
    whatToDo: () => `Click the link yourself to check. For a more reliable automated result, re-run this test on a stronger, more stable internet connection.`
  },
  access_restricted_link: {
    summary: () => `A link on your site leads to a page that asks for a login or password.`,
    whyItMatters: () => `This is often intentional (like an admin area) — but worth a quick check that it's not a page meant to be public.`,
    whatToDo: () => `Confirm this page is supposed to be private. If it should be public, check your server's access settings.`
  },
  broken_image: {
    summary: () => `An image on your site is missing or broken — visitors see a broken image icon instead of a picture.`,
    whyItMatters: () => `Missing images make a site look unfinished or untrustworthy.`,
    whatToDo: () => `Re-upload the image, or fix the file path your site is using to reach it.`
  },
  unverifiable_image: {
    summary: () => `We couldn't confirm whether an image loads correctly — the connection kept failing during testing, even after trying twice.`,
    whyItMatters: () => `This is often a sign of a slow or unstable internet connection during the test, rather than a real problem with the image.`,
    whatToDo: () => `Load the page yourself to check the image. For a more reliable result, re-run this test on a stronger connection.`
  },
  missing_alt: {
    summary: () => `An image is missing a short text description behind the scenes.`,
    whyItMatters: () => `Visitors using screen readers (a tool for the visually impaired) won't know what the image shows. It can also hurt your search engine ranking.`,
    whatToDo: () => `Add a brief, descriptive caption to the image (developers call this "alt text").`
  },
  missing_label: {
    summary: () => `A form field (like a text box) doesn't clearly say what information to type into it.`,
    whyItMatters: () => `Visitors — especially those using screen readers — may not understand what's being asked, and give up on the form.`,
    whatToDo: () => `Add a clear label next to or above the field (for example, "Email Address").`
  },
  non_functional_link_confirmed: {
    summary: (i) => `A button or link${i.linkLabel ? ` ("${i.linkLabel}")` : ''} looks clickable but does nothing when clicked — we confirmed this by actually clicking it during testing.`,
    whyItMatters: () => `Visitors expecting it to do something (show information, start an action) will think your site is broken.`,
    whatToDo: () => `Ask your developer to connect this button/link to whatever it's supposed to do.`
  },
  non_functional_link_unverified: {
    summary: (i) => `A button or link${i.linkLabel ? ` ("${i.linkLabel}")` : ''} appears to have no destination set up.`,
    whyItMatters: () => `It may do nothing when clicked — this is worth checking by hand to be sure.`,
    whatToDo: () => `Click it yourself to see what happens. If nothing does, ask your developer to wire it up.`
  },
  js_error_interaction: {
    summary: (i) => `Clicking something on the page${i.linkLabel ? ` ("${i.linkLabel}")` : ''} caused a hidden technical error.`,
    whyItMatters: () => `That feature may not actually be working for visitors, even though the page still looks normal.`,
    whatToDo: () => `Share this report with your developer — the technical details below point to exactly what broke.`
  },
  uncaught_exception: {
    summary: () => `The page ran into a hidden coding error while loading.`,
    whyItMatters: () => `Some part of the page may not work as expected, even if it looks fine at a glance.`,
    whatToDo: () => `Share this report with your developer to track down the error.`
  },
  failed_network_request: {
    summary: () => `Something the page tried to load in the background failed.`,
    whyItMatters: () => `A feature relying on that resource (a script, a piece of data, etc.) may not work correctly.`,
    whatToDo: () => `Share this report with your developer to check on that resource.`
  },
  layout_overflow: {
    summary: (i) => `Part of your page doesn't fit properly on ${i.viewportLabel || 'some screen sizes'} — content may look cut off or force awkward sideways scrolling.`,
    whyItMatters: () => `Visitors on that size of screen will see a messy or broken layout.`,
    whatToDo: () => `Ask your developer to adjust the page's sizing for that screen size.`
  }
};

const DEFAULT_TEMPLATE = {
  summary: (i) => i.issue || 'An issue was found on your site.',
  whyItMatters: () => `This could affect how visitors experience your site.`,
  whatToDo: () => `Review the technical details below, or share this report with your developer.`
};

function explainIssue(issue) {
  const t = TEMPLATES[issue.category] || DEFAULT_TEMPLATE;
  return {
    summary: t.summary(issue),
    whyItMatters: t.whyItMatters(issue),
    whatToDo: t.whatToDo(issue)
  };
}

// Findings in these categories were never confirmed as real problems — the test just
// couldn't get a clear answer, most often because the connection it was running on kept
// timing out. Counting them alongside confirmed bugs would make the headline number
// misleading (and scarier than the actual result), so they're kept separate everywhere.
const UNVERIFIABLE_CATEGORIES = new Set(['unverifiable_link', 'unverifiable_image', 'navigation_failure_uncertain']);

function isUnverifiable(issue) {
  return UNVERIFIABLE_CATEGORIES.has(issue.category);
}

// A single friendly headline + traffic-light color for the whole report, so someone can
// understand the overall result without reading a single issue card.
function buildPlainSummary(issues, connectionUncertain) {
  const confirmed = issues.filter(i => !isUnverifiable(i));
  const unverifiable = issues.filter(isUnverifiable);

  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  confirmed.forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });

  const seriousCount = counts.Critical + counts.High;
  const total = confirmed.length;

  let headline;
  let trafficLight;
  if (total === 0) {
    headline = 'Everything looks good — no confirmed issues found.';
    trafficLight = 'green';
  } else {
    const parts = [];
    if (seriousCount) parts.push(`${seriousCount} serious`);
    if (counts.Medium) parts.push(`${counts.Medium} moderate`);
    if (counts.Low) parts.push(`${counts.Low} minor`);
    headline = `We found ${total} confirmed issue${total === 1 ? '' : 's'} on your site (${parts.join(', ')}).`;
    trafficLight = seriousCount > 0 ? 'red' : 'yellow';
  }

  const unverifiableNote = unverifiable.length > 0
    ? `We also couldn't get a clear answer on ${unverifiable.length} other item${unverifiable.length === 1 ? '' : 's'} (listed separately below) because the internet connection running this test kept timing out. These are not confirmed problems — re-run the test on a more stable connection for a definite answer.`
    : null;

  const connectionNote = connectionUncertain
    ? `Heads up: we couldn't reliably load your site at all during this test — the connection running it seemed unstable. Consider re-running on a stronger connection before trusting this result.`
    : null;

  return {
    headline,
    trafficLight,
    counts,
    confirmedCount: total,
    unverifiableCount: unverifiable.length,
    unverifiableNote,
    connectionNote
  };
}

module.exports = {
  explainIssue,
  buildPlainSummary,
  isUnverifiable
};
