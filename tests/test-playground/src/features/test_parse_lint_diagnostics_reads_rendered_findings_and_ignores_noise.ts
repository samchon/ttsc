import assert from "node:assert/strict";

import { parseLintDiagnostics } from "../../../../packages/playground/src/compiler/internal/parseLintDiagnostics";

/**
 * Verifies the lint stderr parser recovers each rendered finding with its
 * position, severity, rule, code and token length, and ignores every other
 * line.
 *
 * The lint plugin prints tsgo-style pretty diagnostics, possibly with ANSI
 * colors and CRLF line ends, mixed with summaries and source excerpts. A
 * finding is one `file:line:column - severity TSnnnn: [rule] message` line; the
 * editor needs its length from the identifier-like token that starts at the
 * reported column, falling back to one unit where no token starts there.
 *
 * 1. Parse an error, a colored warning and a bracket-containing message from one
 *    CRLF stderr that also holds a summary, an excerpt and a squiggle line.
 * 2. Place findings on a space, past the end of the line and past the last line,
 *    where no token starts.
 * 3. Parse an empty stderr and one with no finding.
 *
 * @evidence contracts/testing.md#behavioral-verification parseLintDiagnostics returns one normalized diagnostic per rendered finding, strips ANSI color, reads CRLF output, keeps only the first bracketed rule as the rule prefix, measures the identifier token at the reported column and returns nothing for noise. Complete deep-equal arrays reject a missed finding, a parsed excerpt line or a wrong length.
 * @evidence contracts/testing.md#independent-expectations The line format is the tsgo pretty-diagnostic format the lint plugin documents, and each token length is counted by hand from the authored source (value is 5, $id_1 is 5). Positions, severities and codes are literal values written into the authored stderr, not read back from the parser.
 * @evidence contracts/testing.md#distinguishing-cases A token start, a space, a column past the line end and a line past the last contrast for length; error contrasts with warning, a message with and without a rule, and a bracket inside the message; summary, excerpt and squiggle lines contrast with real findings; empty input contrasts with noise only.
 * @evidence contracts/testing.md#execution-ownership This entry calls only the pure parseLintDiagnostics function in the unit process with authored strings; the service-level lint failure handling is owned by test_playground_plugin_failure_lint_never_reports_false_clean.
 */
export function test_parse_lint_diagnostics_reads_rendered_findings_and_ignores_noise(): void {
  const source = "const value = 1;\nvar $id_1 = 2;\r\nlet z = 3;";
  const esc = "\u001b";
  const stderr = [
    "src/playground.ts:1:7 - error TS9001: [no-magic] avoid literals",
    "",
    `${esc}[96msrc/playground.ts${esc}[0m:${esc}[93m2${esc}[0m:${esc}[93m5${esc}[0m - ${esc}[93mwarning${esc}[0m${esc}[90m TS9002: ${esc}[0mprefer const`,
    "",
    "2 var $id_1 = 2;",
    "      ~~~~~",
    "src/playground.ts:3:4 - error TS9003: [r] bracket [inner] stays",
    "src/playground.ts:1:99 - error TS9004: past end",
    "src/playground.ts:9:1 - error TS9005: past last line",
    "Found 5 errors in the same file.",
  ].join("\r\n");

  assert.deepEqual(parseLintDiagnostics(stderr, source), [
    {
      line: 1,
      column: 7,
      length: 5,
      severity: "error",
      message: "[no-magic] avoid literals",
      code: "TS9001",
    },
    {
      line: 2,
      column: 5,
      length: 5,
      severity: "warning",
      message: "prefer const",
      code: "TS9002",
    },
    {
      line: 3,
      column: 4,
      length: 1,
      severity: "error",
      message: "[r] bracket [inner] stays",
      code: "TS9003",
    },
    {
      line: 1,
      column: 99,
      length: 1,
      severity: "error",
      message: "past end",
      code: "TS9004",
    },
    {
      line: 9,
      column: 1,
      length: 1,
      severity: "error",
      message: "past last line",
      code: "TS9005",
    },
  ]);

  assert.deepEqual(parseLintDiagnostics("", source), []);
  assert.deepEqual(
    parseLintDiagnostics("Found 0 errors.\n  1 const value = 1;\n", source),
    [],
  );
}
