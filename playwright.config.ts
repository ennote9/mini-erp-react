import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the real dev app only (Vite port for Tauri: 1420).
 * Start the app first: `npm run tauri dev` or `npm run dev`.
 * Do not use preview as the acceptance target for toolbar checks.
 */
export default defineConfig({
  testDir: "e2e",
  /** Item card flows (tabs, dialogs) can exceed 30s on slow CI agents. */
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:1420",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
