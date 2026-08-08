import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// `__dirname` rather than `import.meta.dirname`, because Playwright loads this
// file through its own TypeScript require hook and the package declares no
// `"type": "module"`, so it evaluates as CommonJS where `import.meta` does not
// exist. The failure is not a bad path: it is a syntax-level crash before test
// discovery, so the end-to-end gate reports zero tests rather than reporting
// that it could not start.
//
// `vite.config.ts` beside this one keeps `import.meta.dirname` and is correct to
// — Vite evaluates its config through an ESM-capable loader that supplies both
// forms. The two files disagree because their loaders do.
const environment = path.resolve(__dirname, ".env");
if (fs.existsSync(environment)) process.loadEnvFile(environment);

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_TEST_PORT ?? 4173);
if (Number.isInteger(port) === false || port < 1 || port > 65_535)
  throw new Error("PLAYWRIGHT_TEST_PORT must be an integer from 1 to 65535.");
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
