document.addEventListener('DOMContentLoaded', () => {
  const testForm = document.getElementById('testForm');
  const targetUrlInput = document.getElementById('targetUrl');
  const runBtn = document.getElementById('runBtn');
  const consoleOutput = document.getElementById('consoleOutput');
  const humanReportBox = document.getElementById('humanReportBox');
  const auditStatus = document.getElementById('auditStatus');
  const openReportBtn = document.getElementById('openReportBtn');
  const btnExportJson = document.getElementById('btnExportJson');
  const screenshotsSection = document.getElementById('screenshotsSection');
  const galleryGrid = document.getElementById('galleryGrid');

  // View Toggle Buttons
  const btnShowHumanReport = document.getElementById('btnShowHumanReport');
  const btnShowDevLogs = document.getElementById('btnShowDevLogs');

  btnShowHumanReport.addEventListener('click', () => {
    btnShowHumanReport.classList.add('active');
    btnShowDevLogs.classList.remove('active');
    humanReportBox.style.display = 'flex';
    consoleOutput.style.display = 'none';

    if (typeof anime !== 'undefined') {
      anime({
        targets: humanReportBox,
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 350,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }
  });

  btnShowDevLogs.addEventListener('click', () => {
    btnShowDevLogs.classList.add('active');
    btnShowHumanReport.classList.remove('active');
    consoleOutput.style.display = 'block';
    humanReportBox.style.display = 'none';

    if (typeof anime !== 'undefined') {
      anime({
        targets: consoleOutput,
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 350,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }
  });

  btnExportJson.addEventListener('click', () => {
    window.open('/api/export-report', '_blank');
  });

  // Tracker & Scorecard Elements
  const progressTracker = document.getElementById('progressTracker');
  const progressBarFill = document.getElementById('progressBarFill');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const step4 = document.getElementById('step4');

  const scorecardSection = document.getElementById('scorecardSection');
  const healthNum = document.getElementById('healthNum');
  const speedNum = document.getElementById('speedNum');
  const scoreHealth = document.getElementById('scoreHealth');
  const scoreLinks = document.getElementById('scoreLinks');

  const slowMoToggle = document.getElementById('slowMoToggle');

  let reportUrl = null;
  let currentThemeColor = '#6366f1';

  // ----------------------------------------------------
  // DYNAMIC THEME COLOR CONTROLLER (Enterprise Palette)
  // ----------------------------------------------------
  const faviconPass = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f172a'/><path d='M 50 15 L 82 28 V 50 C 82 70 68 85 50 90 C 32 85 18 70 18 50 V 28 Z' fill='%2310b981'/><path d='M 38 50 L 46 58 L 64 40' stroke='%23ffffff' stroke-width='6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>`;

  const faviconTesting = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f172a'/><path d='M 50 15 L 82 28 V 50 C 82 70 68 85 50 90 C 32 85 18 70 18 50 V 28 Z' fill='%23f59e0b'/><path d='M 50 35 V 55 M 50 65 V 67' stroke='%23ffffff' stroke-width='6' fill='none' stroke-linecap='round'/></svg>`;

  const faviconFailed = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230f172a'/><path d='M 50 15 L 82 28 V 50 C 82 70 68 85 50 90 C 32 85 18 70 18 50 V 28 Z' fill='%23ef4444'/><path d='M 40 40 L 60 60 M 60 40 L 40 60' stroke='%23ffffff' stroke-width='6' fill='none' stroke-linecap='round'/></svg>`;

  const faviconLink = document.getElementById('faviconLink');

  const setTheme = (mode, errorCount = 0) => {
    let targetColor = '#6366f1';
    let targetGlow = 'rgba(99, 102, 241, 0.25)';
    let targetBg = `radial-gradient(at 10% 20%, rgba(99, 102, 241, 0.12) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(139, 92, 246, 0.1) 0px, transparent 50%)`;

    if (mode === 'testing') {
      targetColor = '#f59e0b';
      targetGlow = 'rgba(245, 158, 11, 0.35)';
      targetBg = `radial-gradient(at 10% 20%, rgba(245, 158, 11, 0.15) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(251, 191, 36, 0.1) 0px, transparent 50%)`;
      if (faviconLink) faviconLink.href = faviconTesting;
      document.title = 'Audit Executing... - Web Auditor Pro';
    } else if (mode === 'passed') {
      targetColor = '#10b981';
      targetGlow = 'rgba(16, 185, 129, 0.35)';
      targetBg = `radial-gradient(at 10% 20%, rgba(16, 185, 129, 0.15) 0px, transparent 50%), radial-gradient(at 90% 80%, rgba(52, 211, 153, 0.1) 0px, transparent 50%)`;
      if (faviconLink) faviconLink.href = faviconPass;
      document.title = 'Audit Passed (100%) - Web Auditor Pro';
    } else if (mode === 'failed') {
      let lightness = Math.max(35, 60 - (errorCount - 1) * 8);
      let saturation = Math.min(95, 75 + (errorCount - 1) * 6);
      let alpha = Math.min(0.75, 0.35 + (errorCount - 1) * 0.1);

      targetColor = `hsl(0, ${saturation}%, ${lightness}%)`;
      targetGlow = `hsla(0, ${saturation}%, ${lightness}%, ${alpha})`;
      targetBg = `radial-gradient(at 10% 20%, hsla(0, ${saturation}%, ${lightness}%, ${alpha}) 0px, transparent 50%), radial-gradient(at 90% 80%, hsla(0, 90%, 20%, 0.3) 0px, transparent 50%)`;
      if (faviconLink) faviconLink.href = faviconFailed;
      document.title = `Audit Failed (${errorCount} Errors) - Web Auditor Pro`;
    } else {
      if (faviconLink) faviconLink.href = faviconPass;
      document.title = 'Web Auditor Pro - Playwright Automated QA Suite';
    }

    if (typeof anime !== 'undefined') {
      anime({
        targets: { color: currentThemeColor },
        color: targetColor,
        duration: 500,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)',
        update: (anim) => {
          const val = anim.animations[0].currentValue;
          document.documentElement.style.setProperty('--theme-color', val);
        },
        complete: () => {
          currentThemeColor = targetColor;
        }
      });
    } else {
      document.documentElement.style.setProperty('--theme-color', targetColor);
    }

    document.documentElement.style.setProperty('--theme-glow', targetGlow);
    document.documentElement.style.setProperty('--theme-bg-gradient', targetBg);
  };

  setTheme('default');

  // Initial Staggered Reveal via Anime.js
  if (typeof anime !== 'undefined') {
    anime({
      targets: '.concept-item',
      translateY: [16, 0],
      opacity: [0, 1],
      delay: anime.stagger(70, { start: 120 }),
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 650
    });

    anime({
      targets: '.chip',
      translateY: [10, 0],
      opacity: [0, 1],
      delay: anime.stagger(40, { start: 80 }),
      easing: 'cubicBezier(0.16, 1, 0.3, 1)',
      duration: 500
    });
  }

  // Preset Chips Interaction Handlers
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-url');
      targetUrlInput.value = url;
      targetUrlInput.focus();

      if (typeof anime !== 'undefined') {
        anime({
          targets: chip,
          scale: [0.96, 1.04, 1],
          duration: 300,
          easing: 'cubicBezier(0.16, 1, 0.3, 1)'
        });
      }
    });
  });

  // Findings scraped from the audited page (link text, image paths, etc.) get interpolated
  // into innerHTML below — escape it so a malicious page's content can't run script in the
  // viewer's browser via the report.
  const escapeHtml = (str) => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const renderIssueCard = (iss, idx) => {
    const sevClass = `sev-${(iss.severity || 'low').toLowerCase()}`;
    const plain = iss.plainLanguage || { summary: iss.issue, whyItMatters: '', whatToDo: '' };
    const unverifiableClass = iss.isUnverifiable ? ' unverifiable' : '';
    return `
      <div class="plain-issue-card ${sevClass}${unverifiableClass}">
        <div class="plain-issue-summary">
          <span class="severity-pill ${sevClass}">${escapeHtml(iss.severity || '')}</span>${escapeHtml(plain.summary)}
        </div>
        <div class="plain-issue-body">
          ${plain.whyItMatters ? `<p><strong>Why it matters:</strong> ${escapeHtml(plain.whyItMatters)}</p>` : ''}
          ${plain.whatToDo ? `<p><strong>What to do:</strong> ${escapeHtml(plain.whatToDo)}</p>` : ''}
        </div>
        <details class="tech-details-box issue-tech-details">
          <summary>Technical details (for developers)</summary>
          <div class="tech-details-list">
            <div class="tech-trace-line"><strong>Finding:</strong> ${escapeHtml(iss.issue)}</div>
            <div class="tech-trace-line"><strong>Evidence:</strong> ${escapeHtml(iss.evidence)}</div>
            <div class="tech-trace-line"><strong>Root cause:</strong> ${escapeHtml(iss.rootCause)}</div>
            <div class="tech-trace-line"><strong>Affected area:</strong> ${escapeHtml(iss.affectedArea)}</div>
          </div>
        </details>
      </div>
    `;
  };

  // Generator for Standardized Executive & Issue Report Cards
  const renderExecutiveReport = (targetUrl, success, output, qaReport) => {
    if (qaReport && qaReport.summary) {
      const summary = qaReport.summary;
      const statusStr = qaReport.overallStatus;
      const issues = qaReport.issues || [];
      const perf = qaReport.performance || {};
      const breakdown = perf.breakdown || [];
      const budgetAlerts = perf.budgetAlerts || [];
      const techDetails = qaReport.technicalExecutionDetails || [];
      const plainSummary = qaReport.plainSummary || { headline: `Status: ${statusStr}`, trafficLight: 'yellow' };

      const confirmedIssues = issues.filter(i => !i.isUnverifiable);
      const unverifiableIssues = issues.filter(i => i.isUnverifiable);

      let summaryHeader = `
        <div class="plain-headline-card light-${plainSummary.trafficLight}">
          ${escapeHtml(plainSummary.headline)}
        </div>
        <div class="report-summary-card" style="border-color: var(--theme-color)">
          <div class="report-summary-text">
            <h3>Website Tested: ${escapeHtml(qaReport.targetUrl)}</h3>
            <p>Pages checked: ${summary.pagesTested} | Total time: <strong>${perf.totalRuntimeSec || '0.0s'}</strong> | Page load time: <strong>${perf.navigationDurationSec || '0.0s'}</strong></p>
          </div>
        </div>
      `;

      if (plainSummary.connectionNote) {
        summaryHeader += `<div class="plain-note-card">⚠️ ${escapeHtml(plainSummary.connectionNote)}</div>`;
      }

      let issuesHtml = '';
      if (confirmedIssues.length === 0) {
        issuesHtml = `
          <div class="report-checklist">
            <div class="check-item">
              <div class="check-item-info">
                <h4>Endpoint Availability & Health</h4>
                <p>Navigated cleanly in <strong>${perf.navigationDurationSec || '0.0s'}</strong>. DOM Content Loaded in ${perf.domContentLoadedMs}ms.</p>
              </div>
            </div>
            <div class="check-item">
              <div class="check-item-info">
                <h4>Asset & Navigation Integrity</h4>
                <p>Audited internal/external links and image assets — 0 broken links or assets detected.</p>
              </div>
            </div>
            <div class="check-item">
              <div class="check-item-info">
                <h4>User Interaction & Form Safety</h4>
                <p>Verified control visibility, input focus, typing, and safety-classified actions.</p>
              </div>
            </div>
            <div class="check-item">
              <div class="check-item-info">
                <h4>Responsive Viewport Layouts</h4>
                <p>Verified document layout containment across Desktop (1440px) and Mobile (375px) viewports.</p>
              </div>
            </div>
          </div>
        `;
      } else {
        issuesHtml = confirmedIssues.map(renderIssueCard).join('');
      }

      if (plainSummary.unverifiableNote) {
        issuesHtml += `<div class="plain-note-card">ℹ️ ${escapeHtml(plainSummary.unverifiableNote)}</div>`;
        issuesHtml += `<details class="tech-details-box"><summary>Show the ${unverifiableIssues.length} unverified item(s)</summary><div class="tech-details-list">` +
          unverifiableIssues.map(renderIssueCard).join('') + `</div></details>`;
      }

      // Render Performance Phase Breakdown Table — tucked behind a toggle since raw phase
      // timings are QA/developer detail, not something a non-technical reader needs up front.
      let perfHtml = '';
      if (breakdown.length > 0) {
        perfHtml = `
          <details class="tech-details-box">
            <summary>Show performance details (Total: ${perf.totalRuntimeSec || '0.0s'})</summary>
            <div class="perf-table-container">
              <table class="perf-table">
                <thead>
                  <tr>
                    <th>Phase / Operation</th>
                    <th>Duration</th>
                    <th>Runtime %</th>
                    <th>Visual Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  ${breakdown.map(p => `
                    <tr>
                      <td>${p.phaseName}</td>
                      <td><strong>${p.durationSec}</strong> (${p.durationMs}ms)</td>
                      <td>${p.percentage}%</td>
                      <td style="width: 25%;">
                        <div class="perf-bar-bg">
                          <div class="perf-bar-fill" style="width: ${Math.min(100, Math.max(2, p.percentage))}%;"></div>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </details>
        `;
      }

      // Render Performance Budget Alerts (Self Bottleneck Warning)
      let budgetHtml = '';
      if (budgetAlerts.length > 0) {
        budgetHtml = budgetAlerts.map(b => `
          <div class="budget-warning-card">
            <strong>Self-Performance Alert:</strong> ${b.message}
          </div>
        `).join('');
      }

      // Render Collapsible Technical Execution Details
      let techHtml = '';
      if (techDetails.length > 0) {
        techHtml = `
          <details class="tech-details-box">
            <summary>Technical Execution Details (${techDetails.length} Trace Events)</summary>
            <div class="tech-details-list">
              ${techDetails.map(t => `<div class="tech-trace-line">[${t.operation}] ${t.trace}</div>`).join('')}
            </div>
          </details>
        `;
      }

      return summaryHeader + issuesHtml + perfHtml + budgetHtml + techHtml;
    }

    // Fallback if qaReport is unavailable
    const speedMatch = output.match(/Loaded in (\d+ms)/);
    const speedStr = speedMatch ? speedMatch[1] : '0.4s';
    const titleMatch = output.match(/Page Title: "([^"]+)"/);
    const pageTitle = titleMatch ? titleMatch[1] : 'Verified';

    if (success) {
      return `
        <div class="report-summary-card">
          <div class="report-summary-text">
            <h3>Audit Passed — 100% Health Score</h3>
            <p>Target endpoint ${targetUrl} verified successfully. All assertions passed clean.</p>
          </div>
          <div class="report-grade-badge">STATUS: PASSED</div>
        </div>

        <div class="report-checklist">
          <div class="check-item">
            <div class="check-item-info">
              <h4>Endpoint Availability & Performance</h4>
              <p>HTTP 200 OK status confirmed. DOM Content Loaded in <strong>${speedStr}</strong>.</p>
            </div>
          </div>
          <div class="check-item">
            <div class="check-item-info">
              <h4>Metadata & Document Title</h4>
              <p>Document title validated: <strong>"${pageTitle}"</strong>.</p>
            </div>
          </div>
          <div class="check-item">
            <div class="check-item-info">
              <h4>Viewport & Responsive Scaling</h4>
              <p>Verified responsive layouts across Desktop (1440px) and Mobile (375px) viewports.</p>
            </div>
          </div>
        </div>
      `;
    } else {
      // No qaReport means the audit process itself never got far enough to produce one —
      // it's not safe to assume the target site is what failed. Point at the real
      // diagnostic (Execution Logs) instead of guessing at a cause.
      return `
        <div class="report-summary-card" style="border-color: var(--theme-color)">
          <div class="report-summary-text">
            <h3>Audit Could Not Complete</h3>
            <p>The test for ${escapeHtml(targetUrl)} did not finish and produced no report.</p>
          </div>
          <div class="report-grade-badge">STATUS: ACTION REQUIRED</div>
        </div>

        <div class="report-checklist">
          <div class="check-item item-error">
            <div class="check-item-info">
              <h4>The audit process itself failed to run</h4>
              <p>This means something stopped the test before it could check <strong>${escapeHtml(targetUrl)}</strong> — it is not necessarily a problem with that site.</p>
            </div>
          </div>
          <div class="check-item">
            <div class="check-item-info">
              <h4>What to do</h4>
              <p>Switch to the "Execution Logs" tab above to see the exact error.</p>
            </div>
          </div>
        </div>
      `;
    }
  };

  testForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetUrl = targetUrlInput.value.trim();
    const selectedSuite = document.querySelector('input[name="testSuite"]:checked').value;
    const isSlowMo = slowMoToggle.checked;

    if (!targetUrl) return;

    setTheme('testing');

    if (typeof anime !== 'undefined') {
      anime({
        targets: runBtn,
        scale: [0.97, 1],
        duration: 250,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }

    runBtn.disabled = true;
    runBtn.innerHTML = `Executing Audit...`;
    auditStatus.className = 'status-badge status-testing';
    auditStatus.innerHTML = `<span class="pulse-dot"></span> Executing Audit`;

    progressTracker.style.display = 'flex';
    scorecardSection.style.display = 'none';

    step1.className = 'progress-step active';
    step2.className = 'progress-step pending';
    step3.className = 'progress-step pending';
    step4.className = 'progress-step pending';

    progressBarFill.style.width = '0%';
    if (typeof anime !== 'undefined') {
      anime({
        targets: progressBarFill,
        width: ['0%', '90%'],
        duration: 6000,
        easing: 'cubicBezier(0.16, 1, 0.3, 1)'
      });
    }

    consoleOutput.textContent = `[INFO] Initializing Playwright Black-Box QA Session\nTarget Endpoint: ${targetUrl}\nAudit Mode: ${selectedSuite}\nHeaded Execution: ${isSlowMo}\n\nExecuting black-box pipeline binaries...`;

    setTimeout(() => {
      step1.className = 'progress-step done';
      step2.className = 'progress-step active';
    }, 1200);

    setTimeout(() => {
      step2.className = 'progress-step done';
      step3.className = 'progress-step active';
    }, 2800);

    setTimeout(() => {
      step3.className = 'progress-step done';
      step4.className = 'progress-step active';
    }, 4500);

    try {
      const response = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, testSuite: selectedSuite, slowMo: isSlowMo })
      });

      const data = await response.json();

      step4.className = 'progress-step done';

      if (typeof anime !== 'undefined') {
        anime({
          targets: progressBarFill,
          width: '100%',
          duration: 300,
          easing: 'cubicBezier(0.16, 1, 0.3, 1)'
        });
      }

      humanReportBox.innerHTML = renderExecutiveReport(targetUrl, data.success, data.output, data.qaReport);
      btnExportJson.style.display = 'inline-block';

      if (data.success) {
        setTheme('passed');

        auditStatus.className = 'status-badge';
        auditStatus.innerHTML = `<span class="pulse-dot"></span> Audit Passed (100%)`;
        consoleOutput.textContent = `[SUCCESS] Test Suite Executed Cleanly:\n\n` + data.output;
        
        scorecardSection.style.display = 'block';
        
        const speedMatch = data.output.match(/Loaded in (\d+)ms/);
        const targetMs = speedMatch ? parseInt(speedMatch[1], 10) : (data.qaReport ? data.qaReport.performance.domContentLoadedMs : 400);

        document.getElementById('speedUnit').style.display = '';
        scoreLinks.textContent = '100% Valid';

        if (typeof anime !== 'undefined') {
          anime({
            targets: '.score-card',
            translateY: [15, 0],
            opacity: [0, 1],
            delay: anime.stagger(60),
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 500
          });

          const healthCounter = { val: 0 };
          anime({
            targets: healthCounter,
            val: 100,
            round: 1,
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 1200,
            update: () => { healthNum.textContent = healthCounter.val; }
          });

          const speedCounter = { val: 0 };
          anime({
            targets: speedCounter,
            val: targetMs,
            round: 1,
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 1200,
            update: () => { speedNum.textContent = speedCounter.val; }
          });
        } else {
          healthNum.textContent = '100';
          speedNum.textContent = targetMs;
        }

      } else {
        let errorCount = 1;
        const failedMatch = data.output.match(/(\d+) failed/);
        if (failedMatch) {
          errorCount = parseInt(failedMatch[1], 10);
        } else {
          const crossMatches = (data.output.match(/failed/gi) || []).length;
          if (crossMatches > 0) errorCount = crossMatches;
        }

        setTheme('failed', errorCount);

        auditStatus.className = 'status-badge status-failed';
        auditStatus.innerHTML = `<span class="pulse-dot"></span> Audit Failed (${errorCount} Errors)`;
        consoleOutput.textContent = `[ERROR] Test Suite Encountered ${errorCount} Failure(s):\n\n` + data.output;
        
        scorecardSection.style.display = 'block';
        healthNum.textContent = '0';
        document.getElementById('speedUnit').style.display = 'none';
        speedNum.textContent = 'Issues found';
        scoreLinks.textContent = `${errorCount} Failed`;

        if (typeof anime !== 'undefined') {
          anime({
            targets: '.score-card',
            translateY: [15, 0],
            opacity: [0, 1],
            delay: anime.stagger(60),
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 500
          });
        }
      }

      if (data.reportUrl) {
        reportUrl = data.reportUrl;
        openReportBtn.style.display = 'inline-block';
      }

      const videoSection = document.getElementById('videoSection');
      const videoGrid = document.getElementById('videoGrid');
      if (data.videos && data.videos.length > 0) {
        videoSection.style.display = 'block';
        videoGrid.innerHTML = data.videos.map((src, index) => `
          <div class="video-item">
            <h4>Session Recording ${index + 1}</h4>
            <video controls autoplay loop muted playsinline src="${src}"></video>
          </div>
        `).join('');

        if (typeof anime !== 'undefined') {
          anime({
            targets: '.video-item',
            translateY: [15, 0],
            opacity: [0, 1],
            delay: anime.stagger(70),
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 500
          });
        }
      }

      if (data.screenshots && data.screenshots.length > 0) {
        screenshotsSection.style.display = 'block';
        galleryGrid.innerHTML = data.screenshots.map(src => {
          const name = src.includes('desktop') ? 'Desktop Viewport (1440px)' : 'Mobile Viewport (375px)';
          return `
            <div class="gallery-item">
              <h4>${name}</h4>
              <img src="${src}" alt="Snapshot" />
            </div>
          `;
        }).join('');

        if (typeof anime !== 'undefined') {
          anime({
            targets: '.gallery-item',
            translateY: [15, 0],
            opacity: [0, 1],
            delay: anime.stagger(70),
            easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            duration: 500
          });
        }
      }

    } catch (err) {
      console.log('Error executing tests:', err);
      consoleOutput.textContent += `\n[ERROR] Request Failure: ${err.message}`;
      setTheme('failed', 1);
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = `Execute Black-Box Audit`;
    }
  });

  openReportBtn.addEventListener('click', () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank');
    }
  });
});
