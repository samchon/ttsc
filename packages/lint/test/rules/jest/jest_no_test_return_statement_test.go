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
func TestRuleCorpusJestNoTestReturnStatement(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-test-return-statement.ts", `import { test } from "@jest/globals";

test("returns", () => {
  // expect: jest/no-test-return-statement error
  return 1;
});
`)
}
