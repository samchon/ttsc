package linthost

import "testing"

// TestRuleCorpusPlaywrightValidExpect verifies the lint rule corpus fixture playwright/valid-expect.ts.
//
// Playwright expect must receive exactly one actual value. This pins the
// argument-count check for empty expect calls.
//
// 1. Load an expect call with no arguments.
// 2. Enable playwright/valid-expect from the annotated expect comment.
// 3. Assert the invalid expect call is reported.
func TestRuleCorpusPlaywrightValidExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-expect.ts", `import { test, expect } from "@playwright/test";

test("expects", async () => {
  // expect: playwright/valid-expect error
  expect();
});
`)
}
