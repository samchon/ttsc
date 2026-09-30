package linthost

import "testing"

// TestRuleCorpusJestNoConditionalExpect verifies the lint rule corpus fixture jest/no-conditional-expect.ts.
//
// Conditional assertions disappear when their branch is not taken. This pins
// the ancestor walk from an expect call to an enclosing conditional inside a
// Jest test callback.
//
// 1. Load a Jest test with an expect call under an if statement.
// 2. Enable jest/no-conditional-expect from the annotated expect comment.
// 3. Assert the conditional expect call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies expect under an if branch is reported for jest/no-conditional-expect; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Conditional execution can omit the assertion. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases The unconditional assertion executes on every callback path. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoConditionalExpect is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoConditionalExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-conditional-expect.ts", `import { test, expect } from "@jest/globals";

test("checks conditionally", () => {
  if (Math.random() > 0.5) {
    // expect: jest/no-conditional-expect error
    expect(true).toBe(true);
  }
});
`)
  assertRuleSkipsSource(t, "jest/no-conditional-expect", "import { test, expect } from \"@jest/globals\"; test(\"always\", () => { expect(1).toBe(1); });\n")
}
