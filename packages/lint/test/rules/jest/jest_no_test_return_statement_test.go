package linthost

import "testing"

// TestRuleCorpusJestNoTestReturnStatement verifies the lint rule corpus fixture
// jest/no-test-return-statement.ts.
//
// Returning from a test body can hide control flow and confuse async handling.
// This pins the rule's walk over the test callback body.
//
// 1. Load a Jest test with a return statement.
// 2. Enable jest/no-test-return-statement from the annotated expect comment.
// 3. Assert the return statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies a return statement inside the test callback is reported for jest/no-test-return-statement; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The policy forbids test-body returns. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A callback with an expression statement has no return branch. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoTestReturnStatement is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoTestReturnStatement(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-test-return-statement.ts", `import { test } from "@jest/globals";

test("returns", () => {
  // expect: jest/no-test-return-statement error
  return 1;
});
`)
  assertRuleSkipsSource(t, "jest/no-test-return-statement", "import { test } from \"@jest/globals\"; test(\"no return\", () => { const value = 1; });\n")
}
