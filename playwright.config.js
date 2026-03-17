// @ts-check
const { defineConfig } = require('@playwright/test');

const authUser = process.env.MATRIX_AUTH_USERNAME || 'testuser';
const authPass = process.env.MATRIX_AUTH_PASSWORD || 'testpass';

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:8000',
    headless: true,
    trace: 'on-first-retry',
    httpCredentials: {
      username: authUser,
      password: authPass,
    },
  },
  webServer: {
    command: `MATRIX_AUTH_USERNAME=${authUser} MATRIX_AUTH_PASSWORD=${authPass} npm run dev`,
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
