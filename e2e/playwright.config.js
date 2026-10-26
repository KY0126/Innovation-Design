const { defineConfig } = require('playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['json', { outputFile: 'results.json' }], ['html', { open: 'never', outputFolder: 'report' }]],
  use: { baseURL: 'http://127.0.0.1:8766', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'zh-TW' },
  webServer: { command: 'python3 -m http.server 8766 --bind 127.0.0.1 --directory ' + (process.env.REPO || '..') + '', url: 'http://127.0.0.1:8766/index.html', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, testMatch: /layout|entry|auth/ },
  ],
});
