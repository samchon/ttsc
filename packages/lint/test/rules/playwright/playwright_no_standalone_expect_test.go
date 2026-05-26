package linthost

import "testing"

// TestRuleCorpusPlaywrightNoStandaloneExpect verifies the lint rule corpus fixture playwright/no-standalone-expect.ts.
//
// Assertions outside Playwright tests do not belong to a test result. This pins
// the nearest test-like ancestor check for expect calls.
//
// 1. Load a top-level expect call.
// 2. Enable playwright/no-standalone-expect from the annotated expect comment.
// 3. Assert the standalone assertion is reported.
func TestRuleCorpusPlaywrightNoStandaloneExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-standalone-expect.ts", `import { expect } from "@playwright/test";

// expect: playwright/no-standalone-expect error
expect(1).toBe(1);
`)
}
