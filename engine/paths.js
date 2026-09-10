/**
 * 📁 Output Path Resolution
 * A single source of truth for where run artifacts (screenshots, qa_report.json) get written.
 * Defaults to the repo-level `snapshots/` dir for plain CLI usage. The hosted dashboard
 * overrides SNAPSHOT_DIR per job so concurrent audits from different users never write into
 * the same shared folder and clobber each other's output.
 */
const path = require('path');

function getSnapshotDir() {
  return process.env.SNAPSHOT_DIR || path.join(__dirname, '..', 'snapshots');
}

// The web-servable URL prefix that maps to getSnapshotDir() on disk. Plain CLI usage serves
// the repo-level snapshots/ dir at /snapshots; the hosted dashboard overrides this per job
// (e.g. /runs/<jobId>/snapshots) to match the isolated directory it actually wrote to.
function getSnapshotUrlPrefix() {
  return process.env.SNAPSHOT_URL_PREFIX || '/snapshots';
}

module.exports = {
  getSnapshotDir,
  getSnapshotUrlPrefix
};
