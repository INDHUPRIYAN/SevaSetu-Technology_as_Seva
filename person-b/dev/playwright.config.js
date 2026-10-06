// Browser tests for Person B's screens, against the REAL reflect + bridge services (in-memory MongoDB)
// behind the mock gateway. Phone, tablet and laptop sizes in Chromium, plus a Firefox phone (test U9).
import { defineConfig, devices } from '@playwright/test';

const chromiumMic = {
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,                                    // one shared database: tests reset it, so run one at a time
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, ...chromiumMic } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, ...chromiumMic } },
    { name: 'laptop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...chromiumMic } },
    {
      name: 'firefox-phone',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 390, height: 844 },
        launchOptions: { firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } },
      },
    },
  ],
  webServer: [
    {
      command: 'node server/stack.cjs',
      url: 'http://localhost:8090/health',
      env: { NO_PROVIDERS: '1' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npx vite --port 5180 --strictPort',
      url: 'http://localhost:5180',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
