import { defineConfig, devices } from '@playwright/test';

const e2ePort = process.env.E2E_PORT ?? '3000';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:e2e',
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: e2ePort,
      E2E_TEST_MODE: 'true',
      AUTH0_SECRET: 'e2e-test-secret-32-chars-minimum!!',
      AUTH0_DOMAIN: 'test.auth0.com',
      AUTH0_CLIENT_ID: 'e2e-client-id',
      AUTH0_CLIENT_SECRET: 'e2e-client-secret',
      AUTH0_AUDIENCE: 'https://booking-api',
      APP_BASE_URL: 'http://127.0.0.1:3000',
      API_URL: 'http://127.0.0.1:3001',
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
    },
  },
});
