import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the lint diagnostic parser accepts every TypeScript source suffix.
 *
 * Corpus diagnostics are exact only when the parser retains the source file and
 * every rendered field without admitting unrelated JavaScript output.
 *
 * 1. Render diagnostics for every supported TypeScript suffix.
 * 2. Preserve file, position, severity, rule, and message expectations.
 * 3. Assert JavaScript and non-canonical uppercase suffixes are ignored.
 */
export const test_lint_diagnostic_parser_accepts_tsx_source_paths =
  (): void => {
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
  };
