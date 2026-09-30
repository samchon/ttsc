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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies a done parameter in the test callback is reported for jest/no-done-callback; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The callback-completion API can hide asynchronous failures. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An async callback without a done parameter avoids that completion mechanism. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoDoneCallback is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoDoneCallback(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-done-callback.ts", `import { test, expect } from "@jest/globals";

// expect: jest/no-done-callback error
test("finishes later", done => {
  expect(1).toBe(1);
  done();
});
`)
  assertRuleSkipsSource(t, "jest/no-done-callback", "import { test } from \"@jest/globals\"; test(\"promise\", async () => {});\n")
}
