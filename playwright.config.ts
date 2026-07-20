import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

const reviewerPasswordHash =
  "scrypt$e19283383dd48dfaadae7f77a44698e9$c928165ce617ca2ea90068af6ef0d6b8b4e99b0f4b9e422dd2ac2703464d3bbb5db9125b8f3fb933e2ff4029b7f172cecb8300ff2ff2ca384b7c848c6ca3d39b";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && NODE_ENV=production PORT=${PORT} AI_FACTORY_AUTH_REQUIRED=true AI_FACTORY_SESSION_SECRET=0123456789abcdef0123456789abcdef AI_FACTORY_REVIEWER_USERNAME=reviewer AI_FACTORY_REVIEWER_PASSWORD_HASH='${reviewerPasswordHash}' AI_FACTORY_COOKIE_SECURE=false npm run start`,
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
