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
func TestRuleCorpusJestNoFocusedTests(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-focused-tests.ts", `import { it, expect } from "@jest/globals";

// expect: jest/no-focused-tests error
it.only("runs one test", () => {
  expect(1).toBe(1);
});
`)
}
