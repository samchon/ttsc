import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code expected plugin restarts do not spend crash budget.
 *
 * `vscode-languageclient` stops restarting after repeated closes in three
 * minutes. Plugin-selection changes are requested lifecycle transitions, so
 * they must bypass that counter while an unannounced close and connection error
 * still delegate to the library's normal policy.
 *
 * 1. Wrap a fallback handler with the extension's pure restart controller.
 * 2. Announce and consume six consecutive expected closes.
 * 3. Assert every close restarts without invoking the fallback crash handler.
 * 4. Send one unannounced close and one error and assert both delegate.
 */
export const test_vscode_expected_plugin_restarts_do_not_spend_crash_budget =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(
          repo,
          "packages",
          "vscode",
          "src",
          "expectedServerRestart.ts",
        ),
      )}).href);
      let closes = 0;
      let errors = 0;
      const fallback = {
        closed() {
          closes++;
          return { action: "fallback-close" };
        },
        error() {
          errors++;
          return { action: "fallback-error" };
        },
      };
      const controller = mod.createExpectedServerRestartHandler(
        fallback,
        { action: "restart", handled: true },
      );
      const expected = [];
      for (let index = 0; index < 6; index++) {
        controller.expectRestart();
        expected.push(await controller.errorHandler.closed());
      }
      const unexpected = await controller.errorHandler.closed();
      const connectionError = await controller.errorHandler.error(
        new Error("transport"),
        undefined,
        1,
      );
      console.log(JSON.stringify({
        closes,
        connectionError,
        errors,
        expected,
        unexpected,
      }));
    `;
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-transform-types",
        "--input-type=module",
        "--eval",
        script,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout) as {
      closes: number;
      connectionError: { action: string };
      errors: number;
      expected: Array<{ action: string; handled: boolean }>;
      unexpected: { action: string };
    };
    assert.equal(actual.expected.length, 6);
    assert.ok(
      actual.expected.every(
        (entry) => entry.action === "restart" && entry.handled,
      ),
    );
    assert.equal(actual.closes, 1);
    assert.deepEqual(actual.unexpected, { action: "fallback-close" });
    assert.equal(actual.errors, 1);
    assert.deepEqual(actual.connectionError, { action: "fallback-error" });
  };
