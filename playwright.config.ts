import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'pnpm exec tsx tests/e2e/serve.ts',
    url: 'http://localhost:4321/smoke.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    trace: 'retain-on-failure',
  },
});
