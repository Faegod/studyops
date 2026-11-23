import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 35_000,
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.STUDYOPS_BROWSER_CHANNEL || undefined,
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'pnpm preview --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
  },
})
