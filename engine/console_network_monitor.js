/**
 * 📡 Console & Network Failure Monitor
 * Captures browser console exceptions, failed 4xx/5xx network calls, and correlates runtime failures.
 */

class ConsoleNetworkMonitor {
  constructor() {
    this.consoleErrors = [];
    this.uncaughtExceptions = [];
    this.failedRequests = [];
    this.slowRequests = [];
  }

  attach(page) {
    this.consoleErrors = [];
    this.uncaughtExceptions = [];
    this.failedRequests = [];
    this.slowRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: Date.now()
        });
      }
    });

    page.on('pageerror', err => {
      this.uncaughtExceptions.push({
        message: err.message,
        stack: err.stack,
        timestamp: Date.now()
      });
    });

    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      
      if (status >= 400) {
        this.failedRequests.push({
          url: url,
          status: status,
          statusText: response.statusText(),
          method: response.request().method(),
          timestamp: Date.now()
        });
      }
    });

    page.on('requestfailed', req => {
      this.failedRequests.push({
        url: req.url(),
        status: 0,
        statusText: req.failure() ? req.failure().errorText : 'Request Aborted',
        method: req.method(),
        timestamp: Date.now()
      });
    });
  }

  getSummary() {
    return {
      consoleErrorCount: this.consoleErrors.length,
      uncaughtExceptionCount: this.uncaughtExceptions.length,
      failedRequestCount: this.failedRequests.length,
      consoleErrors: this.consoleErrors,
      uncaughtExceptions: this.uncaughtExceptions,
      failedRequests: this.failedRequests
    };
  }
}

module.exports = ConsoleNetworkMonitor;
