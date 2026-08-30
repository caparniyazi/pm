import { defineConfig, devices } from "@playwright/test";

// The e2e suite drives the full application: the Next.js static export served by
// FastAPI, backed by SQLite. That whole stack runs in the Docker container, so
// Playwright brings it up with docker compose (reusing one that is already up).
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  use: {
    baseURL: "http://localhost:8000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "docker compose up --build",
    cwd: "..",
    url: "http://localhost:8000/api/hello",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
