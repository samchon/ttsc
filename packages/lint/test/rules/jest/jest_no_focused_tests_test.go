package linthost

import "testing"

// TestRuleCorpusJestNoFocusedTests verifies the lint rule corpus fixture jest/no-focused-tests.ts.
//
// Focused tests are useful locally but make committed suites skip unrelated
// coverage. This pins the Jest call-chain branch that recognizes `.only` on
// test declarations.
//
// 1. Load a Jest test using `it.only`.
// 2. Enable jest/no-focused-tests from the annotated expect comment.
// 3. Assert the focused test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies it.only is reported for jest/no-focused-tests; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Focusing one case excludes sibling coverage. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An ordinary it call does not focus the suite. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoFocusedTests is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoFocusedTests(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-focused-tests.ts", `import { it, expect } from "@jest/globals";

// expect: jest/no-focused-tests error
it.only("runs one test", () => {
  expect(1).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/no-focused-tests", "import { it } from \"@jest/globals\"; it(\"ordinary\", () => {});\n")
}
