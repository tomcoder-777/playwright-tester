# Web Auditor Pro - Enterprise Black-Box QA Platform

An enterprise-grade, high-performance automated website QA platform built with **Playwright**, **Node.js Express**, and **Anime.js**. 

Web Auditor Pro operates strictly on **browser-observable behavior** without requiring access to the target application's repository, database, backend logs, or internal source code.

---

## Key Features

- **Resilient Preflight Inspection:** Performs a two-step navigation strategy (`domcontentloaded` fallback to `commit`) to eliminate 15s timeout failures on slow third-party analytics scripts. Measures browser-observed navigation metrics (`1.1s` / `5.9s`).
- **Failure Dependency Engine:** Prevents cascading false failure alerts. If preflight navigation fails or returns a 4xx/5xx status code, dependent audits are set to `BLOCKED` status instead of throwing misleading downstream errors.
- **Action Safety Classifier:** Scans DOM elements against destructive keyword signatures (`delete`, `remove`, `pay`, `checkout`) to classify interactions into `SAFE` vs `DESTRUCTIVE - REQUIRES USER AUTHORIZATION`.
- **Deduplicated Concurrent Asset Auditor:** Deduplicates image URLs and runs status checks via worker pool concurrency (`concurrency: 8`) with resilient `HEAD` + `GET` fallback.
- **Fast HTTP Link Auditor:** Asynchronously checks internal and external anchor tags using HTTP fetch request pools without opening separate browser tabs.
- **Viewport & Responsive Layout Assertions:** Programmatically checks layout width containment (`scrollWidth > innerWidth`) across Desktop (`1440x900`) and Mobile (`375x812`) viewports and captures full-page snapshots.
- **Audit-Level Performance Breakdown & Self-Budget Alerts:** Tracks phase duration and percentage of total runtime (`%`) across all operations (`Homepage Navigation`, `Discover Links`, `Validate Image Assets`, `Test Forms`, `Viewport & Responsive Layout`). Automatically flags self-bottlenecks if any phase exceeds 40% of runtime.
- **Standardized QA Issue Cards:** Surfaces actionable findings formatted as developer-ready issue cards with Severity, Evidence, Root Cause, Affected Area, and Recommended Action.
- **Collapsible Technical Execution Details:** Separates executive QA summary reports from low-level execution trace lines (`HEAD "/assets/image.webp" — status 200 — 0.08s`), putting raw trace lines under a collapsible UI accordion.
- **Enterprise Visual Dashboard:** Built with Vanilla CSS, dynamic theme transitions (Violet idle, Yellow testing, Green passed, Red error gradient), SVG shield favicon, and smooth Anime.js micro-animations.

---

## Architecture Overview

```
d:\playwright-tester\
├── dashboard\
│   ├── server.js                 # Express API & static report server
│   └── public\
│       ├── index.html            # Enterprise dark-mode dashboard
│       ├── style.css             # Dynamic HSL design system & performance tables
│       └── app.js                # Frontend state controller & Anime.js transitions
├── engine\
│   ├── config.js                 # Timeouts, viewports, crawl limits, & concurrency rules
│   ├── preflight.js              # Resilient navigation & browser performance timing
│   ├── discovery.js              # Instrumented DOM inventory discovery engine
│   ├── safety_classifier.js      # SAFE vs DESTRUCTIVE element classifier
│   ├── navigation_auditor.js     # Deduplicated fast HTTP link auditor
│   ├── asset_auditor.js          # Deduplicated concurrent image auditor (HEAD + GET fallback)
│   ├── form_auditor.js           # Form label & safe non-destructive typing auditor
│   ├── responsive_auditor.js     # Viewport layout overflow assertions & screenshot capture
│   ├── console_network_monitor.js# Console error & 4xx/5xx network failure tracking
│   ├── accessibility_auditor.js  # Automated accessibility observations (headings, alt text)
│   ├── failure_correlator.js     # Failure dependency state engine (PASS/FAIL/BLOCKED)
│   └── report_generator.js       # Standardized QA issue cards & performance breakdown builder
├── tests\
│   └── blackbox_auditor.spec.js  # Primary Playwright test pipeline spec
└── package.json
```

---

## Getting Started

### 1. Installation

```bash
cd d:\playwright-tester
npm install
npx playwright install chromium
```

### 2. Launching the Web Dashboard

```bash
npm run dashboard
```
Open **[http://localhost:3005](http://localhost:3005)** in your browser.

### 3. Command Line Audit Execution

- Run default audit pipeline:
  ```bash
  npx playwright test tests/blackbox_auditor.spec.js --project="Desktop Chrome"
  ```

- Run against custom target URL:
  ```powershell
  $env:TARGET_URL="https://your-website.com"; npx playwright test tests/blackbox_auditor.spec.js --project="Desktop Chrome"
  ```

- Launch Playwright Interactive UI Studio:
  ```bash
  npm run test:ui
  ```

---

## Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3005` | Port for Express dashboard server |
| `TARGET_URL` | `https://example.com` | Target web application endpoint for CLI runs |
| `HEADLESS` | `true` | Runs Playwright in headless browser mode |
