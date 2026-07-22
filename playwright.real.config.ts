import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  'postgresql://jasheets:jasheets_e2e_password@localhost:55432/jasheets_e2e?schema=public';

export default defineConfig({
  testDir: './e2e/real',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/src/main.js',
      url: 'http://localhost:4000/api',
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        DATABASE_URL: databaseUrl,
        API_PORT: '4000',
        JWT_SECRET: 'jasheets-e2e-jwt-secret-at-least-32-characters',
        CORS_ORIGINS: 'http://localhost:3000',
      },
    },
    {
      command: 'pnpm --filter web dev',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000/api',
        NEXT_PUBLIC_WS_URL: 'http://localhost:4000',
      },
    },
  ],
});
