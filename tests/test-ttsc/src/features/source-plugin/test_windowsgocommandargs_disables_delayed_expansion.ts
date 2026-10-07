import assert from "node:assert/strict";

import { windowsGoCommandArgs } from "../../../../../packages/ttsc/src/plugin/internal/source/windowsGoCommandArgs";

/**
 * Verifies the Windows Go wrapper plan disables delayed expansion.
 *
 * The cmd.exe switches `/d /v:off /s /c` (documented cmd options: skip AutoRun,
 * disable delayed expansion, run the quoted payload) must precede the payload.
 *
 * 1. Call windowsGoCommandArgs with the payload string `payload`.
 * 2. Assert the result is exactly `/d`, `/v:off`, `/s`, `/c`, `payload` in that
 *    order.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls windowsGoCommandArgs("payload") and deepEquals the returned argv array; no cmd.exe process is spawned, so this checks the argv plan only.
 * @evidence contracts/testing.md#independent-expectations The expected switches are cmd.exe's documented options (/d no AutoRun, /v:off no delayed expansion, /s /c run the quoted command), written as a literal; the payload is passed through at the last position. The literal is the same constant the function returns, so the test only detects a change to that contract, not an incorrect algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Only one input is used and it contains no percent or exclamation characters, so it distinguishes a dropped, reordered or renamed switch and a payload moved from the last position, but not any metacharacter handling.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/source-plugin; it calls the pure argv builder directly with no process, fixture, package build or installation, and runs on every host.
 */
export const test_windowsgocommandargs_disables_delayed_expansion = () => {
  assert.deepEqual(windowsGoCommandArgs("payload"), [
    "/d",
    "/v:off",
    "/s",
    "/c",
    "payload",
  ]);
};
