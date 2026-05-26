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
func TestRuleCorpusJestNoConditionalInTest(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-conditional-in-test.ts", `import { test, expect } from "@jest/globals";

test("branches", () => {
  // expect: jest/no-conditional-in-test error
  if (Math.random()) {
    expect(1).toBe(1);
  }
});
`)
}
