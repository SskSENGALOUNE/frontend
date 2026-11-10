import { defineConfig, devices } from "@playwright/test";

// Run through scripts/e2e.sh, which starts a throwaway Postgres + the Go backend first.
const PORT = Number(process.env.E2E_PORT ?? 13000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 7_000 },
  workers: 3,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome", // the locally installed Chrome; no browser download needed
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "lo-LA",
    timezoneId: "Asia/Vientiane",
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } }, grep: /@desktop/ },
  ],
  webServer: {
    // serves the .next-e2e build made by scripts/e2e.sh, whose API proxy points at the test backend
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
