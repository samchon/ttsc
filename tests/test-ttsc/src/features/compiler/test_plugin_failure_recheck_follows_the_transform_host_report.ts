import assert from "node:assert/strict";

import { PluginFailureDiagnostics } from "../../../../../packages/ttsc/src/compiler/internal/build/PluginFailureDiagnostics";
import { normalizeBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/normalizeBuildOutput";

/**
 * Verifies the recheck after a failed transform host follows what that host
 * reported.
 *
 * A transform host's `build` reports its Program's diagnostics before it writes
 * outputs. When it failed after printing an error diagnostic, a second check of
 * another Program only adds false reports; when it printed none, the
 * independent check is the only TypeScript report left.
 *
 * 1. Normalize failed host output in the pretty and plain formats, a warning
 *    alone, a Go panic and an empty failure.
 * 2. Ask whether the host reported its Program.
 * 3. Assert only an error diagnostic counts.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the actual normalizer on host output and the actual predicate the build sites consult; a predicate that ignored categories, counted warnings or treated a panic as a report fails.
 * @evidence contracts/testing.md#independent-expectations Expectations follow the protocol's build contract and TypeScript's report formats: an error diagnostic in either format means the host reached its Program diagnostics, while warnings and unparsed text do not.
 * @evidence contracts/testing.md#distinguishing-cases Owns pretty and plain errors, a plugin-coded error, a warning alone, panic text and empty output. The real host connection and the skipped recheck belong to test_ttsc_transform_host_failure_reports_its_own_program_once.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the maintained functions with authored output and launches no producer.
 */
export const test_plugin_failure_recheck_follows_the_transform_host_report =
  () => {
    const failed = (stderr: string) =>
      normalizeBuildOutput({ status: 2, stdout: "", stderr }, "/project");
    const reported = [
      "src/main.ts:3:14 - error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/main.ts(3,14): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/main.ts:3:14 - error TYPIA_ASSERT: Type is not supported.",
    ];
    for (const stderr of reported)
      assert.equal(
        PluginFailureDiagnostics.transformHostReported(failed(stderr)),
        true,
        stderr,
      );
    const unreported = [
      "src/main.ts:3:14 - warning TS6133: 'unused' is declared but its value is never read.",
      "panic: transform host crashed\n\ngoroutine 1 [running]:\nmain.main()\n\t/plugin/main.go:29 +0x24",
      "",
    ];
    for (const stderr of unreported)
      assert.equal(
        PluginFailureDiagnostics.transformHostReported(failed(stderr)),
        false,
        stderr,
      );
  };
