import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
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
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
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
