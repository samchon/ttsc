package linthost

import "testing"

// TestRuleCorpusPlaywrightRequireToPassTimeout verifies the lint rule corpus fixture playwright/require-to-pass-timeout.ts.
//
// toPass without an explicit timeout can wait longer than intended. This pins
// the options-object check for missing timeout.
//
// 1. Load an expect(...).toPass() call with no options.
// 2. Enable playwright/require-to-pass-timeout from the annotated expect comment.
// 3. Assert the toPass call is reported.
func TestRuleCorpusPlaywrightRequireToPassTimeout(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-require-to-pass-timeout.ts", `import { test, expect } from "@playwright/test";

test("passes eventually", async () => {
  // expect: playwright/require-to-pass-timeout error
  await expect(async () => {}).toPass();
});
`)
}
