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
func TestRuleCorpusJestNoDisabledTests(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-disabled-tests.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-disabled-tests error
test.skip("does not run", () => {
  expect(1).toBe(1);
});
`)
}
