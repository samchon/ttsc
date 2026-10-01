import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/strip plugin: configured calls and statements are removed
 * while unconfigured neighbors survive.
 *
 * The scenario's tsconfig names only the plugin; `strip.config.json` beside it
 * supplies `console.log`, `console.debug`, `assert.*` and `debugger`. The
 * shared baseline also contains `console.warn` and `console.info`, which the
 * configuration does not name and which must remain, and a guarded
 * `console.log` whose statement must disappear without breaking the `if`.
 *
 * 1. Emit the shared baseline with declarations through the configured scenario.
 * 2. Assert the configured calls, wildcard call and statement are absent from
 *    the JavaScript and the declaration stays clean.
 * 3. Assert the unconfigured calls survive and the emitted file still runs.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsc emit of the baseline must drop log/debug/assert.equal/debugger and the guarded log, retain warn/info, StripBox and value declarations, and run under Node printing kept.
 * @evidence contracts/testing.md#independent-expectations The authored strip.config.json lists and the baseline source establish which calls are present before and absent after; nothing is derived from the plugin's own output.
 * @evidence contracts/testing.md#distinguishing-cases Configured removals and the wildcard are positive; console.warn and console.info beside them are negative neighbors; the guarded call is a position boundary. The default, override, explicit-path and inline-key scenarios own the other configuration sources.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_strip through TestExecutor with the shared workspace; it runs the built launcher and native strip plugin, while AST list and position decisions belong to the Go linked-program units.
 * @evidence contracts/e2e.md#necessary-boundary Auto-discovered strip.config.json must travel through the launcher to the native statement mutation and produce valid executable JavaScript and clean declarations.
 * @evidence contracts/e2e.md#shared-execution Reuses the experiment's single workspace copy, package link and plugin cache; only its configuration directory differs from the sibling scenarios, and one emit and one Node run serve all assertions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Writes only under this scenario's dist directory; the baseline and sibling configurations are not modified and no cache is asserted cold or warm.
 * @evidence contracts/e2e.md#preserved-coverage Keeps every former configured-removal assertion (log, debug, assert.equal, debugger, guarded call, console.info, declarations, Node stdout) and adds console.warn as an unconfigured negative control.
 */
export function case_strip_configured_calls_and_statements(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "configured";
  const result = UtilityWorkspace.emit(workspace, scenario);
  assert.equal(result.status, 0, result.stderr);
  const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
  assert.doesNotMatch(js, /console\.(?:log|debug)/);
  assert.doesNotMatch(js, /\bdebugger\b/);
  assert.doesNotMatch(js, /assert\.equal/);
  assert.doesNotMatch(js, /guarded-log-call/);
  assert.match(js, /console\.info\("kept"\)/);
  assert.match(js, /console\.warn\("warn-call"\)/);
  const dts = UtilityWorkspace.read(workspace, scenario, "dist/main.d.ts");
  assert.match(dts, /interface StripBox/);
  assert.match(dts, /value: string/);
  assert.doesNotMatch(dts, /console|debugger|assert/);
  const run = TestProject.runNode(
    path.join(UtilityWorkspace.project(workspace, scenario), "dist", "main.js"),
    { cwd: UtilityWorkspace.project(workspace, scenario) },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "kept");
}
