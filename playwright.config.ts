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
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run test:serve',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      TEST_MODE: 'true',
    }
  },
});
