import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-ui',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Usar un solo worker para no colisionar el backend (sala en memoria)
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      },
    },
  ],

  webServer: [
    {
      // Keep the in-memory room and its WebSocket alive for the entire test run.
      command: 'node --import tsx apps/server/src/index.ts',
      url: 'http://127.0.0.1:3333/health',
      reuseExistingServer: false,
      env: { TEST_MODE: 'true' },
    },
    {
      command: 'npm --workspace @dnd-tactical/web run dev -- --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
    },
  ],
});
