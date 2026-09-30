package linthost

import "testing"

// TestRuleCorpusJestNoConditionalInTest verifies the lint rule corpus fixture
// jest/no-conditional-in-test.ts.
//
// Branching inside tests can hide assertions behind runtime paths. This pins
// the generic conditional scan separately from the expect-specific rule.
//
// 1. Load a Jest test containing an if statement.
// 2. Enable jest/no-conditional-in-test from the annotated expect comment.
// 3. Assert the conditional statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies an if statement in a test is reported for jest/no-conditional-in-test; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The policy disallows conditional callback paths. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A straight-line assertion removes the branch. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoConditionalInTest is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoConditionalInTest(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-conditional-in-test.ts", `import { test, expect } from "@jest/globals";

test("branches", () => {
  // expect: jest/no-conditional-in-test error
  if (Math.random()) {
    expect(1).toBe(1);
  }
});
`)
  assertRuleSkipsSource(t, "jest/no-conditional-in-test", "import { test, expect } from \"@jest/globals\"; test(\"straight\", () => { expect(1).toBe(1); });\n")
}
