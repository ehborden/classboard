// Tests open index.html directly from disk, so there is no server to start.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  reporter: 'list',
  use: { browserName: 'chromium', viewport: { width: 1400, height: 860 } },
});
