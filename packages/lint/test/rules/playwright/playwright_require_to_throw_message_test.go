package linthost

import "testing"

// TestRuleCorpusPlaywrightRequireToThrowMessage verifies the lint rule corpus fixture playwright/require-to-throw-message.ts.
//
// toThrow without an expected message can pass for the wrong error. This pins
// the zero-argument matcher branch.
//
// 1. Load an expect(...).toThrow() call with no expected message.
// 2. Enable playwright/require-to-throw-message from the annotated expect comment.
// 3. Assert the toThrow call is reported.
func TestRuleCorpusPlaywrightRequireToThrowMessage(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-require-to-throw-message.ts", `import { test, expect } from "@playwright/test";

test("throws", async () => {
  // expect: playwright/require-to-throw-message error
  expect(() => {
    throw new Error("boom");
  }).toThrow();
});
`)
}
