import { defineConfig } from "@playwright/test";

const reuse = !process.env.CI;

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:8786",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm exec wrangler dev --config ../../workers/pass/wrangler.jsonc --port 8787",
      url: "http://127.0.0.1:8787/health",
      reuseExistingServer: reuse,
      timeout: 90_000,
    },
    {
      command:
        "pnpm exec wrangler dev --config ../../workers/link/wrangler.jsonc --port 8788",
      url: "http://127.0.0.1:8788/health",
      reuseExistingServer: reuse,
      timeout: 90_000,
    },
    {
      command:
        "pnpm exec wrangler dev --config ../../workers/gateway/wrangler.jsonc --port 8786",
      url: "http://127.0.0.1:8786/health",
      reuseExistingServer: reuse,
      timeout: 90_000,
    },
  ],
});
