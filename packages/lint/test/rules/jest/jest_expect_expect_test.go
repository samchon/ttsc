package linthost

import "testing"

// TestRuleCorpusJestExpectExpect verifies the lint rule corpus fixture jest/expect-expect.ts.
//
// Jest tests without assertions can pass without checking behavior. This pins
// the SourceFile scan that finds a test callback and verifies it contains an
// expect-family call.
//
// 1. Load a Jest test body with no assertion.
// 2. Enable jest/expect-expect from the annotated expect comment.
// 3. Assert the unasserted test call is reported.
func TestRuleCorpusJestExpectExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-expect-expect.ts", `import { test } from "@jest/globals";

// expect: jest/expect-expect error
test("loads data", () => {
  const value = 1 + 1;
});
`)
}
