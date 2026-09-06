import { defineConfig, devices } from '@playwright/test'

const DEV = 'http://localhost:4174'
const PROD = 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
  },
  projects: [
    {
      name: 'dev',
      testIgnore: [/mobile\.spec/, /prod-smoke\.spec/],
      use: { ...devices['Desktop Chrome'], baseURL: DEV },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec/,
      use: { ...devices['Pixel 5'], baseURL: DEV },
    },
    {
      name: 'prod',
      testMatch: /prod-smoke\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: PROD },
    },
  ],
  // E2E_DEV_ONLY=1 skips the production build/preview server (faster local iteration).
  webServer: [
    {
      // `npm run dev` (not bare `npx vite`) so predev copies the pdf.js assets to public/pdfjs.
      command: 'npm run dev -- --port 4174 --strictPort',
      url: DEV,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(process.env.E2E_DEV_ONLY
      ? []
      : [
          {
            command: 'npm run build && npx vite preview --port 4173 --strictPort',
            url: PROD,
            reuseExistingServer: !process.env.CI,
            timeout: 300_000,
          },
        ]),
  ],
})
