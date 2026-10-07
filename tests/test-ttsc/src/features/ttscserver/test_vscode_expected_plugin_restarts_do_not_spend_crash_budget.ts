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
 * @evidence contracts/testing.md#behavioral-verification Builds the controller with createExpectedServerRestartHandler around a counting fallback, calls expectRestart then errorHandler.closed() six times, then one unannounced closed() and one error(), and asserts the returned actions and the fallback call counters.
 * @evidence contracts/testing.md#independent-expectations Supported language-client action values are authored literals: CloseAction.Restart is 2, CloseAction.DoNotRestart and ErrorAction.Continue are 1. Each announced close returns the supplied restart object by identity; unannounced closes and errors return distinct fallback objects and literal call counts.
 * @evidence contracts/testing.md#distinguishing-cases Six consecutive announced closes (so the marker must re-arm each time and be one-shot) are contrasted with an unannounced close, which delegates once and is not treated as a restart, and a connection error, which always delegates; an implementation that left the flag set after one close or sent errors to the restart path would change the counters or actions.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it imports the actual expectedServerRestart controller and supplies handler results annotated with the supported parameter types without loading an editor host, language client or child process.
 */
export async function test_vscode_expected_plugin_restarts_do_not_spend_crash_budget() {
  let closes = 0;
  let errors = 0;
  const closeResult: Awaited<
    ReturnType<
      Parameters<typeof mod.createExpectedServerRestartHandler>[0]["closed"]
    >
  > = { action: 1, message: "fallback-close" };
  const errorResult: Awaited<
    ReturnType<
      Parameters<typeof mod.createExpectedServerRestartHandler>[0]["error"]
    >
  > = { action: 1, message: "fallback-error" };
  const restart: Parameters<typeof mod.createExpectedServerRestartHandler>[1] =
    { action: 2, handled: true };
  const transportError = new Error("transport");
  const fallback: Parameters<typeof mod.createExpectedServerRestartHandler>[0] =
    {
      closed() {
        closes++;
        return closeResult;
      },
      error(error, message, count) {
        errors++;
        assert.equal(error, transportError);
        assert.equal(message, undefined);
        assert.equal(count, 1);
        return errorResult;
      },
    };
  const controller = mod.createExpectedServerRestartHandler(fallback, restart);
  for (let index = 0; index < 6; index++) {
    controller.expectRestart();
    assert.equal(await controller.errorHandler.closed(), restart);
  }
  assert.equal(closes, 0);
  assert.equal(await controller.errorHandler.closed(), closeResult);
  assert.equal(closes, 1);
  assert.equal(
    await controller.errorHandler.error(transportError, undefined, 1),
    errorResult,
  );
  assert.equal(errors, 1);
}
