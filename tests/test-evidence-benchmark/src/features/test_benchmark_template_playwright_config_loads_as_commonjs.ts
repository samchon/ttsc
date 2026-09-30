import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { acquireBenchmarkWorkspace } from "../internal/benchmarkWorkspace";
import { scriptEnvironment } from "../internal/scriptEnvironment";

/**
 * Loads the delivered configuration through the actual installed Playwright CLI.
 *
 * Listing delivered tests exercises the real loader without starting a browser.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs installed playwright test --list against prepared configuration, requiring zero status and nonempty Chromium discovery; invalid port zero fails with the literal configuration diagnostic.
 * @evidence contracts/testing.md#independent-expectations Zero/nonzero statuses, positive test count, Chromium label and port-range diagnostic are authored expectations. No regex-transpiled configuration, stub defineConfig or manifest spelling supplies observed behavior.
 * @evidence contracts/testing.md#distinguishing-cases Normal port 4173 discovers real testDir; port zero rejects before discovery. Both use the unchanged prepared package and actual loader, so module-system failure cannot pass through a substitute evaluator.
 * @evidence contracts/testing.md#execution-ownership The original named feature remains in E2E; two joined CLI requests own assertions here. Chart/report and home source operations live in src/unit without this loader.
 * @evidence contracts/e2e.md#necessary-boundary Actual Playwright TypeScript loading and delivered package mode determine evaluation; source-string checks or a custom CommonJS evaluator cannot establish their connection.
 * @evidence contracts/e2e.md#shared-execution Reuses the suite's single prepared Evidence arm and installed dependency; both requests add no installer, native producer, browser download or preview server.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Child-only sanitized environments supply contrasting ports without changing globals or configuration. Synchronous children finish before the next; suite lifetime owns workspace release.
 * @evidence contracts/e2e.md#preserved-coverage Actual configuration evaluation, object validation and testDir discovery strengthen old synthetic object/testDir checks. Manifest-type meta checking becomes observed loader behavior; no frozen template changes.
 */
export const test_benchmark_template_playwright_config_loads_as_commonjs =
  async (): Promise<void> => {
    const workspace = await acquireBenchmarkWorkspace("evidence");
    const frontend = path.join(workspace.workspace, "packages", "frontend");
    const entrypoint = process.env.npm_execpath;
    assert.ok(entrypoint, "This suite must run through pnpm");
    const requests = ["4173", "0"].map((port) => spawnSync(
      process.execPath,
      [entrypoint, "exec", "playwright", "test", "--list", "--config", "playwright.config.ts"],
      {
        cwd: frontend,
        env: scriptEnvironment({ PLAYWRIGHT_TEST_PORT: port }),
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        shell: false,
        windowsHide: true,
      },
    ));
    const [normal, invalid] = requests;
    assert.equal(normal!.error, undefined);
    assert.equal(normal!.status, 0, normal!.stderr);
    assert.match(normal!.stdout, /\[chromium\]/);
    const total = /Total: (\d+) tests? in (\d+) files?/.exec(normal!.stdout);
    assert.ok(total, normal!.stdout);
    assert.ok(Number(total[1]) > 0 && Number(total[2]) > 0, normal!.stdout);
    assert.equal(invalid!.error, undefined);
    assert.notEqual(invalid!.status, 0);
    assert.match(`${invalid!.stdout}${invalid!.stderr}`, /PLAYWRIGHT_TEST_PORT must be an integer from 1 to 65535/);
  };
