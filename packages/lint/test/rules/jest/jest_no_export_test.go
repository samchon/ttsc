package linthost

import "testing"

// TestRuleCorpusJestNoExport verifies the lint rule corpus fixture jest/no-export.ts.
//
// Exporting from test files can make test modules part of production import
// graphs. This pins both declaration-level export modifiers and export
// statements.
//
// 1. Load a Jest test file with an exported helper value.
// 2. Enable jest/no-export from the annotated expect comment.
// 3. Assert the exported declaration is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies an exported helper declaration is reported for jest/no-export; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The test-module policy forbids exporting declarations. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A private helper used by the test has no export modifier. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoExport is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoExport(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-export.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-export error
export const helper = 1;

test("uses helper", () => {
  expect(helper).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/no-export", "import { test, expect } from \"@jest/globals\"; const helper = 1; test(\"private\", () => { expect(helper).toBe(1); });\n")
}
