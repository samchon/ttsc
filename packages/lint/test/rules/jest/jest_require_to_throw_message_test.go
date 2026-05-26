package linthost

import "testing"

// TestRuleCorpusJestRequireToThrowMessage verifies the lint rule corpus fixture
// jest/require-to-throw-message.ts.
//
// Message-less throw assertions can pass for the wrong exception. This pins the
// matcher chain path from `expect(fn).toThrow()`.
//
// 1. Load a message-less toThrow matcher.
// 2. Enable jest/require-to-throw-message from the annotated expect comment.
// 3. Assert the matcher call is reported.
func TestRuleCorpusJestRequireToThrowMessage(t *testing.T) {
  assertRuleCorpusCase(t, "jest-require-to-throw-message.ts", `import { test, expect } from "@jest/globals";

test("throws", () => {
  // expect: jest/require-to-throw-message error
  expect(() => { throw new Error("x"); }).toThrow();
});
`)
}
