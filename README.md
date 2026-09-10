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

### Multi-User Hosting Hardening

The dashboard runs a real browser per audit against a caller-supplied URL — hosting it for
others requires the following, all configured via environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | *(unset)* | Enables HTTP Basic Auth on the entire dashboard (UI + API). **If unset, the dashboard runs with no authentication at all** — a startup warning is logged; never expose it on a public domain in that state. |
| `MAX_CONCURRENT_AUDITS` | `1` | How many audits run at once. Each audit is a real Chromium instance — keep this low unless the host has real headroom. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `5` / `600000` (10 min) | Max audits a single IP can start per time window. |
| `QUEUE_MAX` | `10` | Hard cap on jobs queued + running at once; further requests get `429` until it drains. |
| `MAX_RETAINED_RUNS` | `20` | Oldest completed run directories (`runs/<jobId>/`) are pruned beyond this count. |
| `TRUST_PROXY` | `false` | Set to `true` only when a real reverse proxy (nginx/Caddy) sits in front and sets `X-Forwarded-For` — otherwise rate limiting can be trivially bypassed by spoofing that header. |

Every target URL is also checked by `engine/ssrf_guard.js` before any navigation happens: only
`http`/`https` are allowed, and both the literal hostname and its resolved DNS addresses are
rejected if they fall in a private/loopback/link-local range (including cloud metadata
addresses like `169.254.169.254`) — this is what stops the tool's own server from being used
as an SSRF proxy into its host's internal network.

---

## Pushing to GitHub

```bash
git add -A
git commit -m "Your commit message"
git push origin master
```

That's it if a remote is already configured (`git remote -v` shows one). If not, create an
empty repository on GitHub first, then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin master
```

---

## Deploying to Render.com (Free)

This app is a long-running Node/Express server that launches a real headless browser per
audit — it needs a host that runs a persistent process, not a serverless-functions platform
(Vercel, Netlify Functions). Render's free web-service tier fits: no card required, no expiry,
built from the `Dockerfile` in this repo (which is based on Playwright's own image, so Chromium
and all its OS-level dependencies come preinstalled — no extra setup needed). The trade-off is
that a free instance spins down after 15 minutes of no traffic and takes roughly 30-60 seconds
to wake back up on the next request.

1. **Push this repo to GitHub** (see the section above) — Render deploys from a Git repo, not
   from local files.
2. On [render.com](https://render.com), sign up/log in, then click **New +** → **Web Service**.
3. Connect your GitHub account and select this repository.
4. Render should auto-detect the `Dockerfile` and set the **Environment** to `Docker`. Leave
   the build/start commands blank — the `Dockerfile` already defines them.
5. Pick the **Free** instance type.
6. Under **Environment Variables**, add at minimum:
   - `TRUST_PROXY` = `true` (Render sits behind its own proxy — without this, rate limiting
     would see Render's IP instead of each real visitor's)
   - `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` — **set these before sharing the URL with
     anyone.** Without them the dashboard has no login at all.
7. Click **Create Web Service**. The first build takes several minutes (it's pulling a multi-GB
   base image with browsers preinstalled) — watch the build logs in the Render dashboard.
8. Once live, Render gives you a URL like `https://web-auditor-pro.onrender.com`. That's your
   public link — share it with the username/password you set in step 6.

Prefer one click instead of the manual form? This repo also includes a `render.yaml` — on
Render, use **New +** → **Blueprint** and point it at this repo instead of step 2-6 above; it
configures the same settings automatically (you'll still be prompted to fill in the username/
password, since those are intentionally excluded from the file).

Each audit runs in an isolated `runs/<jobId>/` directory (screenshots, Playwright HTML report,
video) so concurrent audits from different users never overwrite each other's output — this
replaced an earlier version that reused one shared `snapshots/`/`test-results/` folder per
request.
