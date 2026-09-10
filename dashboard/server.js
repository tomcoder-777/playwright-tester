const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const { isTargetUrlSafe } = require('../engine/ssrf_guard');

const app = express();
const PORT = process.env.PORT || 3005;

// Behind a reverse proxy (nginx/Caddy in front, terminating TLS for your domain), req.ip
// would otherwise show the proxy's own address instead of the real client — breaking rate
// limiting. Only trust X-Forwarded-For when explicitly told a real proxy sits in front.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json());

const rootDir = path.join(__dirname, '..');
const runsRoot = path.join(rootDir, 'runs');
if (!fs.existsSync(runsRoot)) fs.mkdirSync(runsRoot, { recursive: true });

// ---------------------------------------------------------------------------------------
// Authentication — a single shared username/password gate (HTTP Basic Auth). Good enough
// for "myself and a few trusted people" hosting; not a multi-tenant account system. If the
// env vars aren't set, the dashboard runs with NO authentication — fine for local/dev use
// on your own machine, but it must never be exposed on a public domain in that state.
// ---------------------------------------------------------------------------------------
const AUTH_USER = process.env.DASHBOARD_USERNAME;
const AUTH_PASS = process.env.DASHBOARD_PASSWORD;

if (!AUTH_USER || !AUTH_PASS) {
  console.log('\n[SECURITY WARNING] DASHBOARD_USERNAME/DASHBOARD_PASSWORD are not set.');
  console.log('[SECURITY WARNING] The dashboard is running with NO AUTHENTICATION.');
  console.log('[SECURITY WARNING] Do not expose this on a public domain in this state.\n');
} else {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const sepIdx = decoded.indexOf(':');
      const user = decoded.slice(0, sepIdx);
      const pass = decoded.slice(sepIdx + 1);
      const userOk = user.length === AUTH_USER.length && crypto.timingSafeEqual(Buffer.from(user), Buffer.from(AUTH_USER));
      const passOk = pass.length === AUTH_PASS.length && crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(AUTH_PASS));
      if (userOk && passOk) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Web Auditor Pro"');
    res.status(401).send('Authentication required.');
  });
}

// ---------------------------------------------------------------------------------------
// Rate limiting & queue capacity — prevents one caller (or a burst of callers) from queuing
// unbounded audits. Each audit spins up a real Chromium instance, so this is a real resource
// budget, not a formality.
// ---------------------------------------------------------------------------------------
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(10 * 60 * 1000), 10);
const QUEUE_MAX = parseInt(process.env.QUEUE_MAX || '10', 10);
const MAX_CONCURRENT_AUDITS = parseInt(process.env.MAX_CONCURRENT_AUDITS || '1', 10);
const MAX_RETAINED_RUNS = parseInt(process.env.MAX_RETAINED_RUNS || '20', 10);

const rateLimitLog = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (rateLimitLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  rateLimitLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------------------
// Job queue — each audit gets its own isolated output directory (runs/<jobId>/) so
// concurrent requests from different users never clobber each other's screenshots/reports,
// which the previous single-shared-folder implementation did.
// ---------------------------------------------------------------------------------------
const jobs = new Map(); // jobId -> job record
const queue = [];
let runningCount = 0;

function pruneOldRuns() {
  const finished = Array.from(jobs.values())
    .filter(j => j.status === 'done' || j.status === 'error')
    .sort((a, b) => a.createdAt - b.createdAt);

  while (finished.length > MAX_RETAINED_RUNS) {
    const oldest = finished.shift();
    jobs.delete(oldest.id);
    const dir = path.join(runsRoot, oldest.id);
    fs.rm(dir, { recursive: true, force: true }, () => {});
  }
}

function findWebmVideos(dir, urlPrefix, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findWebmVideos(filePath, urlPrefix, fileList);
    } else if (file.endsWith('.webm')) {
      const relPath = path.relative(dir, filePath).replace(/\\/g, '/');
      fileList.push(`${urlPrefix}/${relPath}`);
    }
  }
  return fileList;
}

function startJob(job) {
  job.status = 'running';
  job.startedAt = Date.now();
  runningCount++;

  const runDir = path.join(runsRoot, job.id);
  const snapshotDir = path.join(runDir, 'snapshots');
  const testResultsDir = path.join(runDir, 'test-results');
  const reportDir = path.join(runDir, 'playwright-report');
  fs.mkdirSync(snapshotDir, { recursive: true });

  let testFile = 'tests/blackbox_auditor.spec.js';
  if (job.testSuite === 'health') testFile = 'tests/01_health_check.spec.js';
  else if (job.testSuite === 'links') testFile = 'tests/02_links_and_navigation.spec.js';
  else if (job.testSuite === 'interactive') testFile = 'tests/03_interactive_elements.spec.js';
  else if (job.testSuite === 'visual') testFile = 'tests/04_responsive_and_visual.spec.js';

  // "Headed" mode launches a real, visible browser window — that only works on a machine
  // with an actual display. Hosted servers (Render, and most other platforms) are headless
  // containers with no display at all, so honoring this on a host would crash the whole
  // audit before it even starts. Render sets RENDER=true automatically; FORCE_HEADLESS lets
  // any other headless host opt in explicitly. Session video recording already gives a
  // visual record of what happened, so nothing is lost by ignoring the toggle here.
  const isHeadlessOnlyHost = process.env.RENDER === 'true' || process.env.FORCE_HEADLESS === 'true';
  if (job.slowMo && isHeadlessOnlyHost) {
    console.log(`[INFO] [job ${job.id}] Ignoring "headed" request — this host has no display. Running headless (see the session video for a visual record).`);
  }
  const slowMoFlag = (job.slowMo && !isHeadlessOnlyHost) ? '--headed' : '';

  // "Desktop Chrome" (playwright.config.js) uses channel: 'chrome' — that means "find a real,
  // separately-installed Google Chrome on this system," not Playwright's own bundled browser.
  // That happens to exist on a normal desktop (hence it working locally), but a server built
  // from Playwright's own Docker image only ships Playwright's bundled Chromium/Firefox/WebKit
  // — no real system Chrome. On a host without one, that project fails at browser launch,
  // before any test code runs, regardless of headed/headless. The "Chromium" project uses
  // Playwright's bundled browser instead, which is guaranteed present wherever Playwright
  // itself is installed, so the dashboard always uses that rather than depend on the host
  // happening to have a real Chrome install.
  const command = `npx playwright test ${testFile} --project="Chromium" ${slowMoFlag}`;
  console.log(`[INFO] [job ${job.id}] Executing: TARGET_URL=${job.targetUrl} ${command}`);

  exec(command, {
    cwd: rootDir,
    env: {
      ...process.env,
      TARGET_URL: job.targetUrl,
      SNAPSHOT_DIR: snapshotDir,
      SNAPSHOT_URL_PREFIX: `/runs/${job.id}/snapshots`,
      PW_OUTPUT_DIR: testResultsDir,
      PW_HTML_REPORT_DIR: reportDir
    }
  }, (error, stdout, stderr) => {
    const output = stdout + '\n' + stderr;
    const passed = !error;

    let screenshots = [];
    if (fs.existsSync(snapshotDir)) {
      screenshots = fs.readdirSync(snapshotDir)
        .filter(f => f.endsWith('.png'))
        .map(f => `/runs/${job.id}/snapshots/${f}?t=${Date.now()}`);
    }

    const videos = findWebmVideos(testResultsDir, `/runs/${job.id}/test-results`);

    let qaReport = null;
    const reportJsonPath = path.join(snapshotDir, 'qa_report.json');
    if (fs.existsSync(reportJsonPath)) {
      try {
        qaReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
      } catch (e) {}
    }

    job.status = 'done';
    job.finishedAt = Date.now();
    job.result = {
      success: passed,
      targetUrl: job.targetUrl,
      output: output,
      qaReport: qaReport,
      screenshots: screenshots,
      videos: videos,
      reportUrl: `/runs/${job.id}/playwright-report/index.html`
    };

    runningCount--;
    pruneOldRuns();
    processQueue();
  });
}

function processQueue() {
  while (queue.length > 0 && runningCount < MAX_CONCURRENT_AUDITS) {
    const jobId = queue.shift();
    const job = jobs.get(jobId);
    if (job) startJob(job);
  }
}

// ---------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/runs', express.static(runsRoot));

app.post('/api/run-test', async (req, res) => {
  const { targetUrl, testSuite, slowMo } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required' });
  }

  if (isRateLimited(req.ip)) {
    return res.status(429).json({ error: `Rate limit exceeded — max ${RATE_LIMIT_MAX} audits per ${Math.round(RATE_LIMIT_WINDOW_MS / 60000)} minutes. Try again shortly.` });
  }

  if (queue.length + runningCount >= QUEUE_MAX) {
    return res.status(429).json({ error: 'The audit queue is full. Try again shortly.' });
  }

  let formattedUrl = targetUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  const safety = await isTargetUrlSafe(formattedUrl);
  if (!safety.safe) {
    return res.status(400).json({ error: `Target URL rejected: ${safety.reason}` });
  }

  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    targetUrl: formattedUrl,
    testSuite: testSuite || 'auto',
    slowMo: !!slowMo,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    result: null
  };
  jobs.set(jobId, job);
  queue.push(jobId);
  processQueue();

  res.status(202).json({
    jobId,
    status: job.status,
    queuePosition: queue.indexOf(jobId) + 1
  });
});

app.get('/api/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Unknown job ID (it may have been pruned after completion).' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    queuePosition: job.status === 'queued' ? queue.indexOf(job.id) + 1 : 0,
    ...(job.result || {})
  });
});

app.get('/api/export-report/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Unknown job ID.' });

  const reportJsonPath = path.join(runsRoot, job.id, 'snapshots', 'qa_report.json');
  if (fs.existsSync(reportJsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="qa_report.json"');
    res.sendFile(reportJsonPath);
  } else {
    res.status(404).json({ error: 'No report artifact found for this job.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`[INFO] Web Auditor Pro Platform Active`);
  console.log(`[INFO] Endpoint: http://localhost:${PORT}`);
  console.log(`[INFO] Max concurrent audits: ${MAX_CONCURRENT_AUDITS} | Rate limit: ${RATE_LIMIT_MAX}/${Math.round(RATE_LIMIT_WINDOW_MS / 60000)}min | Queue cap: ${QUEUE_MAX}`);
  console.log(`==================================================\n`);
});
