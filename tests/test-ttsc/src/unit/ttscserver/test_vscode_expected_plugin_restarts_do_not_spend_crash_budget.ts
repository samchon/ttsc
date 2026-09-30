import assert from "node:assert/strict";
import * as mod from "../../../../../packages/vscode/src/expectedServerRestart";

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
 *
 * @evidence contracts/testing.md#behavioral-verification The restart controller consumes six announced closes without fallback and delegates the later unexpected close and error.
 * @evidence contracts/testing.md#independent-expectations Authored edit records and literal restart/fallback results and counters independently define the supported policy.
 * @evidence contracts/testing.md#distinguishing-cases Six expected closes contrast with unexpected close/error and exact restart/fallback values and counters.
 * @evidence contracts/testing.md#execution-ownership The named src/unit/ttscserver entry calls the authored pure module directly, retaining the original serialized result view and every behavioral assertion without an editor host or child process.
 */
export async function test_vscode_expected_plugin_restarts_do_not_spend_crash_budget() {
  const actual = JSON.parse(JSON.stringify(await (async () => {
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
        fallback as unknown as Parameters<typeof mod.createExpectedServerRestartHandler>[0],
        { action: "restart", handled: true } as unknown as Parameters<typeof mod.createExpectedServerRestartHandler>[1],
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
      return {
        closes,
        connectionError,
        errors,
        expected,
        unexpected,
      };
  })())) as {
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
  }