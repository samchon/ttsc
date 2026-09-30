import assert from "node:assert/strict";
import { windowsGoCommandArgs } from "../../../../../packages/ttsc/src/plugin/internal/source/windowsGoCommandArgs";

/**
 * Verifies the Windows Go wrapper plan disables delayed expansion.
 *
 * The fixed cmd switches keep percent/exclamation-sensitive payload delivery
 * under the wrapper's literal-argument protocol; actual execution stays E2E.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored command-plan function and preserves the exact /d /v:off /s /c payload vector moved from the Windows wrapper matrix.
 * @evidence contracts/testing.md#independent-expectations The literal cmd switch contract requires disabled delayed expansion and the exact authored payload as its last argument.
 * @evidence contracts/testing.md#distinguishing-cases This pure vector check runs on every host; actual metacharacter/lookup behavior remains in the Windows source-plugin boundary case.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls the source formatter directly with no process, fixture, package build or installation.
 */
export const test_windowsgocommandargs_disables_delayed_expansion = () => {
  assert.deepEqual(windowsGoCommandArgs("payload"), [
    "/d", "/v:off", "/s", "/c", "payload",
  ]);
};
