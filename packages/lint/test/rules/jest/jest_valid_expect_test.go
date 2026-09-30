package linthost

import "testing"

// TestRuleCorpusJestValidExpect verifies the lint rule corpus fixture jest/valid-expect.ts.
//
// Bare `expect(value)` calls evaluate but assert nothing. This pins the matcher
// chain validation after an expect call has the correct single argument shape.
//
// 1. Load a Jest test with a bare expect call.
// 2. Enable jest/valid-expect from the annotated expect comment.
// 3. Assert the invalid expect usage is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies a bare expect(1) call is reported for jest/valid-expect; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations An actual value without a matcher asserts nothing. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases A toBe matcher completes the assertion chain. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestValidExpect is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestValidExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-expect.ts", `import { test, expect } from "@jest/globals";

test("checks value", () => {
  // expect: jest/valid-expect error
  expect(1);
});
`)
  assertRuleSkipsSource(t, "jest/valid-expect", "import { test, expect } from \"@jest/globals\"; test(\"matcher\", () => { expect(1).toBe(1); });\n")
}
