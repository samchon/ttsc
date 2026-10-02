import assert from "node:assert/strict";

import { normalizeBuildOutput } from "../../../../../packages/ttsc/src/compiler/internal/build/normalizeBuildOutput";
import type { ITtscCompilerDiagnostic } from "../../../../../packages/ttsc/src/structures/ITtscCompilerDiagnostic";

/**
 * Verifies normalization preserves continuation boundaries and supplied reports.
 *
 * Blank, summary and unrelated unindented lines do not end the current report.
 * A new diagnostic does. Supplied reports bypass parsing, including an empty
 * array, while failure stream relocation preserves the actual captured bytes.
 *
 * 1. Parse ANSI/CRLF text with multiple continuations and skipped summary lines.
 * 2. Require complete literal diagnostics and reset continuation at the next report.
 * 3. Contrast supplied records and an empty array with parsed and unrelated text.
 * 4. Compare successful output, failed stdout and already present stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual imported normalizeBuildOutput and compares complete diagnostic records, continuation whitespace, ordering, supplied-array identity and output streams; no producer is simulated or launched.
 * @evidence contracts/testing.md#independent-expectations Authored diagnostic headlines, literal line/column/code values and authored continuation text establish complete expected records. Empty and supplied arrays must bypass parsing under the result contract; failure relocation must preserve the literal original stdout bytes rather than the ANSI-stripped parsing view.
 * @evidence contracts/testing.md#distinguishing-cases Multiple continuations, trailing whitespace, blank/TSFILE/Found summary lines, an unrelated unindented line, a second diagnostic, leading orphan indentation and entirely unmatched text cover parsing boundaries. Supplied empty/nonempty reports contrast with absent reports; success, blank/nonblank stderr and whitespace-only stdout delimit relocation.
 * @evidence contracts/testing.md#execution-ownership The matching unit feature and Evidence export directly import the source normalizer with captured-data inputs in process. No filesystem fixture, installed consumer, native artifact, compiler process, source extraction or foreign-method replacement is used.
 */
export function test_normalize_build_output_preserves_continuation_boundaries_and_supplied_reports(): void {
  const failures: Error[] = [];
  const check = (name: string, run: () => void): void => {
    try { run(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const stdout = [
    "  orphan before any report",
    "\x1b[31msource.ts:2:4 - error TS2322: first headline\x1b[0m",
    "  first detail   ",
    "",
    "TSFILE: emitted.js",
    "Found 2 errors.",
    "unrelated status line",
    "\tsecond detail\t ",
    "warning PLUGIN_RULE: next headline",
    "  next detail  ",
  ].join("\r\n");
  check("complete continuation records", () => {
    const result = normalizeBuildOutput({ status: 0, stdout, stderr: "" });
    assert.deepEqual(result.diagnostics, [
      { file: "source.ts", category: "error", code: 2322, line: 2, character: 4, messageText: "first headline\n  first detail\n\tsecond detail" },
      { file: null, category: "warning", code: "PLUGIN_RULE", messageText: "next headline\n  next detail" },
    ]);
    assert.equal(result.stdout, stdout);
    assert.equal(result.stderr, "");
  });
  check("supplied reports bypass parsing", () => {
    const reports: ITtscCompilerDiagnostic[] = [{ file: null, category: "message", code: "SUPPLIED", messageText: "literal supplied report" }];
    const result = normalizeBuildOutput({ status: 0, stdout, stderr: "", diagnostics: reports });
    assert.equal(result.diagnostics, reports);
    assert.equal(result.diagnostics[0], reports[0]);
    assert.deepEqual(result.diagnostics, [{ file: null, category: "message", code: "SUPPLIED", messageText: "literal supplied report" }]);
    const empty: ITtscCompilerDiagnostic[] = [];
    assert.equal(normalizeBuildOutput({ status: 0, stdout, stderr: "", diagnostics: empty }).diagnostics, empty);
  });
  check("unmatched and empty text", () => {
    assert.deepEqual(normalizeBuildOutput({ status: 0, stdout: "ordinary text\n  orphan detail", stderr: "" }).diagnostics, []);
    assert.deepEqual(normalizeBuildOutput({ status: 0, stdout: "", stderr: "" }).diagnostics, []);
  });
  check("failure stream visibility preserves bytes", () => {
    const moved = normalizeBuildOutput({ status: 7, stdout, stderr: " \t" });
    assert.equal(moved.status, 7);
    assert.equal(moved.stdout, "");
    assert.equal(moved.stderr, stdout);
    assert.equal(moved.diagnostics.length, 2);
    const retained = normalizeBuildOutput({ status: 7, stdout: "out", stderr: "error" });
    assert.equal(retained.stdout, "out");
    assert.equal(retained.stderr, "error");
    const blank = normalizeBuildOutput({ status: 7, stdout: " \t", stderr: "" });
    assert.equal(blank.stdout, " \t");
    assert.equal(blank.stderr, "");
  });
  if (failures.length) throw new AggregateError(failures, "Output normalization distinctions failed");
}
