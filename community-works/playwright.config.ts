import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: false, workers: 1,
  reporter: [['list']], use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'node tests/browser/server.mjs', url: 'http://127.0.0.1:4187/community-works/', reuseExistingServer: false },
})
