import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: a type error is reported once, at its
 * authored line, quoting authored source rather than the banner.
 *
 * The banner shifts emitted lines, so a diagnostic computed against the
 * transformed text would point past the real error and its code frame would
 * quote the preamble. The scenario's only error sits on line 5.
 *
 * 1. Emit a project containing one type error.
 * 2. Assert the build fails and every reported `main.ts` position is line 5.
 * 3. Assert TS2322 is reported once and the output never quotes the banner.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher must fail the build and report TS2322 once at main.ts line 5 without quoting banner text, in either rendered position form.
 * @evidence contracts/testing.md#independent-expectations The authored source places the error on line 5 and the TypeScript error code is TS2322; neither is derived from the plugin.
 * @evidence contracts/testing.md#distinguishing-cases A positive line check detects an uncorrected banner shift, the single-count check detects duplicate reporting per lane, and banner-text absence detects a code frame over transformed text.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_banner with the shared workspace; real launcher stderr is inspected because rendering depends on the native host and recovery pass.
 * @evidence contracts/e2e.md#necessary-boundary Diagnostic collection, the banner transform and rendering meet in the native host; only the public command output shows the position a user sees.
 * @evidence contracts/e2e.md#shared-execution Reuses the shared workspace, package link, plugin cache and configuration; its erroneous source is the only distinct input and requires its own failing compile.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario owns its source and writes no output that another scenario reads; the process is joined before assertions.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former line, single-report and banner-quote assertions; the banner is now four rather than three lines, a larger shift for the same check.
 */
export function case_banner_diagnostic_lines_point_at_original_source(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const errorLine = 5;
  const result = UtilityWorkspace.emit(workspace, "diagnostic");
  assert.notEqual(result.status, 0, "the type error must fail the build");

  const stderr = `${result.stderr}\n${result.stdout}`.replace(
    /\u001b\[[0-9;]*m/g,
    "",
  );
  // Both rendered forms are accepted: the native host prints `file:line:col -`
  // and the plugin-free recovery pass prints `file(line,col):`.
  const positions = [
    ...stderr.matchAll(/main\.ts(?::(\d+):\d+|\((\d+),\d+\))/g),
  ].map((match) => Number(match[1] ?? match[2]));
  assert.ok(
    positions.length > 0,
    `stderr reported no position for main.ts:\n${stderr}`,
  );
  for (const line of positions) {
    assert.equal(
      line,
      errorLine,
      `diagnostic reported at main.ts line ${line}, want ${errorLine} (the banner shift was not corrected)\n${stderr}`,
    );
  }
  assert.equal(
    stderr.split("TS2322").length - 1,
    1,
    `the same error must be reported once, not once per lane:\n${stderr}`,
  );
  assert.doesNotMatch(
    stderr,
    /Copyright|MIT License|@packageDocumentation/,
    `the code frame must quote the authored source, never the banner:\n${stderr}`,
  );
}
