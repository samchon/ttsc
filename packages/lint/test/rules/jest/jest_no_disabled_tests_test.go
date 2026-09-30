package linthost

import "testing"

// TestRuleCorpusJestNoDisabledTests verifies the lint rule corpus fixture jest/no-disabled-tests.ts.
//
// Disabled test declarations silently reduce coverage. This pins the Jest
// call-chain branch that recognizes `.skip` on test and describe calls.
//
// 1. Load a Jest test using `test.skip`.
// 2. Enable jest/no-disabled-tests from the annotated expect comment.
// 3. Assert the disabled test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies test.skip is reported for jest/no-disabled-tests; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations A skipped declaration silently excludes its case. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An ordinary declaration stays scheduled. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoDisabledTests is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoDisabledTests(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-disabled-tests.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-disabled-tests error
test.skip("does not run", () => {
  expect(1).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/no-disabled-tests", "import { test } from \"@jest/globals\"; test(\"scheduled\", () => {});\n")
}
