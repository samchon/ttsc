package linthost

import "testing"

// TestRuleCorpusJestNoDoneCallback verifies the lint rule corpus fixture jest/no-done-callback.ts.
//
// Done callbacks make async assertion failures easy to mask. This pins the
// parameter scan on Jest test callbacks without flagging nested promise
// callbacks.
//
// 1. Load a Jest test callback with a `done` parameter.
// 2. Enable jest/no-done-callback from the annotated expect comment.
// 3. Assert the done parameter is reported.
func TestRuleCorpusJestNoDoneCallback(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-done-callback.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-done-callback error
test("finishes later", done => {
  expect(1).toBe(1);
  done();
});
`)
}
