import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the lint diagnostic parser accepts both TSX and TS source paths.
 *
 * Preserving a corpus fixture as `src/main.tsx` also changes the filename in
 * rendered diagnostics. The parser must retain TSX lint records without
 * regressing the original TS path or accepting unrelated JavaScript output.
 *
 * 1. Render adjacent TSX, TS, and JavaScript diagnostic lines.
 * 2. Parse the combined stderr stream.
 * 3. Assert both TypeScript records survive and the JavaScript line is ignored.
 */
export const test_lint_diagnostic_parser_accepts_tsx_source_paths =
  (): void => {
    const stderr = [
      "src/main.tsx:6:12 - error TS9001: [react/jsx-key] Missing key.",
      "src/main.ts:2:3 - warning TS9002: [no-console] Unexpected console.",
      "src/main.js:1:1 - error TS9003: [no-debugger] Unexpected debugger.",
    ].join("\n");

    assert.deepEqual(TestLint.parseDiagnostics(stderr), [
      {
        file: "src/main.tsx",
        line: 6,
        column: 12,
        severity: "error",
        rule: "react/jsx-key",
        message: "Missing key.",
      },
      {
        file: "src/main.ts",
        line: 2,
        column: 3,
        severity: "warn",
        rule: "no-console",
        message: "Unexpected console.",
      },
    ]);
  };
