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
func TestRuleCorpusJestNoConditionalExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-conditional-expect.ts", `import { test, expect } from "@jest/globals";

test("checks conditionally", () => {
  if (Math.random() > 0.5) {
    // expect: jest/no-conditional-expect error
    expect(true).toBe(true);
  }
});
`)
}
