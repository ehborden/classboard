// Tests open index.html directly from disk, so there is no server to start.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1400, height: 860 },
    // A fake camera, so the document camera can be tested without real hardware.
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
});
