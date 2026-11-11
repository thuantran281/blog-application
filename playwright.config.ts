import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const baseURL = 'http://127.0.0.1:3100'
const port = new URL(baseURL).port

dotenv.config({ path: path.join(rootDir, 'server/.env'), quiet: true })

export default defineConfig({
  testDir: path.join(rootDir, 'e2e'),
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm --prefix server run start',
    url: `${baseURL}/health/ready`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: port,
      CLIENT_DIST_PATH: path.join(rootDir, 'client/dist'),
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
    },
  },
})
