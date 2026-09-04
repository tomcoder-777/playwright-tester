const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const rootDir = path.join(__dirname, '..');
const reportDir = path.join(rootDir, 'playwright-report');
const snapshotDir = path.join(rootDir, 'snapshots');
const testResultsDir = path.join(rootDir, 'test-results');

if (!fs.existsSync(snapshotDir)) fs.mkdirSync(snapshotDir, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/report', express.static(reportDir));
app.use('/snapshots', express.static(snapshotDir));
app.use('/test-results', express.static(testResultsDir));

// Helper to clear directory contents before running new tests
function clearDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const curPath = path.join(dirPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          fs.rmSync(curPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(curPath);
        }
      }
    } catch (e) {
      console.log(`[WARN] Cleanup error for ${dirPath}: ${e.message}`);
    }
  }
}

// Helper to find all .webm video files recursively in test-results
function findWebmVideos(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findWebmVideos(filePath, fileList);
    } else if (file.endsWith('.webm')) {
      const relPath = path.relative(testResultsDir, filePath).replace(/\\/g, '/');
      fileList.push(`/test-results/${relPath}?t=${Date.now()}`);
    }
  }
  return fileList;
}

// Endpoint to run Black-Box QA Audit (Auto Mode or Filtered)
app.post('/api/run-test', (req, res) => {
  const { targetUrl, testSuite, slowMo } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required' });
  }

  let formattedUrl = targetUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  clearDirectory(snapshotDir);
  clearDirectory(testResultsDir);

  let testFile = 'tests/blackbox_auditor.spec.js';
  if (testSuite === 'health') testFile = 'tests/01_health_check.spec.js';
  else if (testSuite === 'links') testFile = 'tests/02_links_and_navigation.spec.js';
  else if (testSuite === 'interactive') testFile = 'tests/03_interactive_elements.spec.js';
  else if (testSuite === 'visual') testFile = 'tests/04_responsive_and_visual.spec.js';

  const slowMoFlag = slowMo ? '--headed' : '';
  const command = `npx playwright test ${testFile} --project="Desktop Chrome" ${slowMoFlag}`;
  console.log(`[INFO] Executing Audit: TARGET_URL=${formattedUrl} ${command}`);

  exec(command, {
    cwd: rootDir,
    env: { ...process.env, TARGET_URL: formattedUrl }
  }, (error, stdout, stderr) => {
    const output = stdout + '\n' + stderr;
    const passed = !error;

    let screenshots = [];
    if (fs.existsSync(snapshotDir)) {
      screenshots = fs.readdirSync(snapshotDir)
        .filter(f => f.endsWith('.png'))
        .map(f => `/snapshots/${f}?t=${Date.now()}`);
    }

    const videos = findWebmVideos(testResultsDir);

    // Read generated QA report JSON if available
    let qaReport = null;
    const reportJsonPath = path.join(snapshotDir, 'qa_report.json');
    if (fs.existsSync(reportJsonPath)) {
      try {
        qaReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
      } catch (e) {}
    }

    res.json({
      success: passed,
      targetUrl: formattedUrl,
      output: output,
      qaReport: qaReport,
      screenshots: screenshots,
      videos: videos,
      reportUrl: '/report/index.html'
    });
  });
});

// JSON Export Route
app.get('/api/export-report', (req, res) => {
  const reportJsonPath = path.join(snapshotDir, 'qa_report.json');
  if (fs.existsSync(reportJsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="qa_report.json"');
    res.sendFile(reportJsonPath);
  } else {
    res.status(404).json({ error: 'No report artifact found. Run an audit first.' });
  }
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`[INFO] Web Auditor Pro Platform Active`);
  console.log(`[INFO] Endpoint: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
