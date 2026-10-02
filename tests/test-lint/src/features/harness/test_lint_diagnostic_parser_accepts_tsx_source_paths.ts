import { TestLint } from "../../../../utils/src/lint/TestLint";
import assert from "node:assert/strict";

/**
 * Verifies the lint diagnostic parser accepts every TypeScript source suffix.
 *
 * Corpus diagnostics are exact only when the parser retains the source file and
 * every rendered field without admitting unrelated JavaScript output.
 *
 * 1. Render diagnostics for every supported TypeScript suffix.
 * 2. Preserve file, position, severity, rule, and message expectations.
 * 3. Assert JavaScript and non-canonical uppercase suffixes are ignored, and that
 *    ANSI-colored CRLF output yields the plain trimmed record.
 *
 * @evidence contracts/testing.md#behavioral-verification TestLint.parseDiagnostics preserves all rendered fields for canonical TypeScript source suffixes and excludes JavaScript and uppercase suffix output; ANSI escapes and CRLF are stripped from a colored line and unrelated text yields nothing.
 * @evidence contracts/testing.md#independent-expectations Literal diagnostic records independently define file, line, column, rule, severity and message. Rendering those records is an inverse format fixture, not a value copied from parser output.
 * @evidence contracts/testing.md#distinguishing-cases TSX, spaced TS paths, module and declaration suffixes succeed; JavaScript and uppercase TS/TSX/declaration messages are explicit negative controls. A colored CRLF banner with trailing spaces is the formatting contrast, and a line that is not a diagnostic is the adjacent non-match.
 * @evidence contracts/testing.md#execution-ownership Calls the authored diagnostic parser on an in-memory stderr string, with no process needed to generate that string.
 */
export function test_lint_diagnostic_parser_accepts_tsx_source_paths(): void {
    const expected: TestLint.ILintDiagnostic[] = [
      {
        file: "src/main.tsx",
        line: 6,
        column: 12,
        severity: "error",
        rule: "react/jsx-key",
        message: "Missing key.",
      },
      {
        file: "src/my fixture.ts",
        line: 2,
        column: 3,
        severity: "warn",
        rule: "no-console",
        message: "Unexpected console.",
      },
      ...[
        "src/component fixture.mts",
        "src/main.cts",
        "src/main.d.ts",
        "src/main.d.mts",
        "src/main.d.cts",
      ].map(
        (file, index): TestLint.ILintDiagnostic => ({
          file,
          line: index + 10,
          column: 2,
          severity: "error",
          rule: "fixture/rule",
          message: `Message ${index}.`,
        }),
      ),
    ];
    const stderr = [
      ...expected.map(
        ({ file, line, column, severity, rule, message }) =>
          `${file}:${line}:${column} - ${
            severity === "warn" ? "warning" : "error"
          } TS9001: [${rule}] ${message}`,
      ),
      "src/main.js:1:1 - error TS9003: [no-debugger] Unexpected debugger.",
      "src/uppercase.TS:1:1 - error TS9003: [fixture/rule] Ignored.",
      "src/uppercase.TSX:1:1 - error TS9003: [fixture/rule] Ignored.",
      "src/uppercase.D.TS:1:1 - error TS9003: [fixture/rule] Ignored.",
    ].join("\n");

    assert.deepEqual(TestLint.parseDiagnostics(stderr), expected);

    // A colored TTY run wraps the banner in ANSI escapes and a Windows child
    // ends its lines with CRLF; both must still yield the plain record, with
    // the trailing message whitespace trimmed.
    assert.deepEqual(
      TestLint.parseDiagnostics(
        "\u001b[96msrc/color.ts\u001b[0m:3:4 - \u001b[91merror\u001b[0m TS9001: [no-var] Unexpected var.  \r\n",
      ),
      [
        {
          file: "src/color.ts",
          line: 3,
          column: 4,
          severity: "error",
          rule: "no-var",
          message: "Unexpected var.",
        },
      ],
    );
    assert.deepEqual(TestLint.parseDiagnostics("not a diagnostic line\n"), []);
}
