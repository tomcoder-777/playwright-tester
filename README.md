# Web Auditor Pro - Enterprise Black-Box QA Platform

An automated website QA platform built with **Playwright**, **Node.js/Express**, and a visual dashboard. Point it at any URL and it audits the site the way a real user/browser experiences it — no access to the target's source code, database, or backend required.

It ships as two things you can evaluate independently:

- **A visual dashboard** (`npm run dashboard`) — enter a URL, click run, watch the audit stream live, and read a standardized issue-card report in the browser.
- **A Playwright test suite** (`npx playwright test`) — the same audits runnable from the command line / CI, with HTML trace reports, screenshots, and video on failure.

---

## Quick Start (Evaluate in ~5 minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- Git

### 1. Clone and install
```bash
git clone https://github.com/tomcoder-777/playwright-tester.git
cd playwright-tester
npm install
npx playwright install
```
`npx playwright install` downloads Playwright's own bundled Chromium/Firefox/WebKit — no system browser installation required.

### 2. Run the dashboard
```bash
npm run dashboard
```
Open **http://localhost:3005**, pick a target (a few presets are built in, e.g. Wikipedia, Hacker News, or type your own URL), and click **Execute Black-Box Audit**. Results stream live and finish as a plain-English + technical issue report.

### 3. Or run it from the command line
```bash
npx playwright test tests/blackbox_auditor.spec.js --project=Chromium
```
```bash
# against your own target
TARGET_URL="https://your-website.com" npx playwright test tests/blackbox_auditor.spec.js --project=Chromium   # macOS/Linux
$env:TARGET_URL="https://your-website.com"; npx playwright test tests/blackbox_auditor.spec.js --project=Chromium   # Windows PowerShell
```
```bash
npm run test:report   # opens the HTML trace report (traces, screenshots, video)
```

> Use `--project=Chromium` (Playwright's own bundled browser). The `"Desktop Chrome"` project uses a real, system-installed Google Chrome via `channel: 'chrome'` and will fail if that's not present on your machine.

---

## Key Features

- **Resilient Preflight Inspection:** Two-step navigation strategy (`domcontentloaded` fallback to `commit`) to avoid false timeout failures on slow third-party analytics scripts. Reports real browser-observed navigation timing.
- **Failure Dependency Engine:** Prevents cascading false failures — if preflight navigation fails or returns a 4xx/5xx status, dependent audits are marked `BLOCKED` instead of throwing misleading downstream errors.
- **Action Safety Classifier:** Scans DOM elements for destructive keyword signatures (`delete`, `remove`, `pay`, `checkout`) and classifies interactions as `SAFE` vs `DESTRUCTIVE - REQUIRES USER AUTHORIZATION` before touching them.
- **Deduplicated Concurrent Asset Auditor:** Deduplicates image URLs and checks them via a worker-pool (`concurrency: 8`) with resilient `HEAD` + `GET` fallback.
- **Fast HTTP Link Auditor:** Checks internal and external links via async HTTP fetch pools without opening separate browser tabs.
- **Viewport & Responsive Layout Assertions:** Checks for horizontal overflow (`scrollWidth > innerWidth`) across Desktop (`1440x900`) and Mobile (`375x812`) viewports, and captures full-page snapshots.
- **Performance Breakdown & Self-Budget Alerts:** Tracks how long each audit phase takes and flags the run itself if any single phase eats more than 40% of total runtime.
- **Standardized QA Issue Cards:** Findings are reported as issue cards with Severity, Evidence, Root Cause, Affected Area, and Recommended Action — collapsible raw trace lines sit underneath for anyone who wants the technical detail.
- **Enterprise Visual Dashboard:** Live-updating dark-mode UI with themed status states (idle / testing / passed / error) and smooth animated transitions.

---

## Architecture Overview

```
playwright-tester/
├── dashboard/
│   ├── server.js                  # Express API & static report server
│   └── public/
│       ├── index.html             # Dashboard UI
│       ├── style.css              # Design system & report styling
│       └── app.js                 # Frontend controller — submits jobs, renders results
├── engine/
│   ├── config.js                  # Timeouts, viewports, crawl limits, concurrency rules
│   ├── preflight.js               # Resilient navigation & performance timing
│   ├── discovery.js               # DOM inventory discovery (pages, links, forms, elements)
│   ├── safety_classifier.js       # SAFE vs DESTRUCTIVE element classifier
│   ├── navigation_auditor.js      # Deduplicated fast HTTP link auditor
│   ├── asset_auditor.js           # Deduplicated concurrent image auditor (HEAD + GET fallback)
│   ├── form_auditor.js            # Form label & safe non-destructive input auditor
│   ├── responsive_auditor.js      # Viewport layout overflow assertions & screenshot capture
│   ├── console_network_monitor.js # Console error & 4xx/5xx network failure tracking
│   ├── accessibility_auditor.js   # Automated accessibility observations (headings, alt text)
│   ├── failure_correlator.js      # Failure dependency state engine (PASS/FAIL/BLOCKED)
│   └── report_generator.js        # Standardized QA issue cards & performance breakdown builder
├── tests/
│   ├── blackbox_auditor.spec.js       # Full 9-stage audit pipeline (what the dashboard runs)
│   ├── 01_health_check.spec.js        # Standalone: HTTP status, title, load time
│   ├── 02_links_and_navigation.spec.js# Standalone: link integrity scan
│   ├── 03_interactive_elements.spec.js# Standalone: buttons/controls respond to interaction
│   ├── 04_responsive_and_visual.spec.js# Standalone: viewport snapshots
│   └── helpers/human_actions.js       # Human-like click/type helpers used by the suites
└── package.json
```

The four standalone specs (`01`–`04`) map to the four individual "Audit Mode" options in the dashboard; `blackbox_auditor.spec.js` is the full combined pipeline behind "AUTO AUDIT MODE."

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3005` | Port for the Express dashboard server |
| `TARGET_URL` | `https://example.com` | Target URL for CLI/`npx playwright test` runs |
| `HEADLESS` | `true` | Runs Playwright in headless browser mode |

---

## License

MIT — see [LICENSE](LICENSE).
