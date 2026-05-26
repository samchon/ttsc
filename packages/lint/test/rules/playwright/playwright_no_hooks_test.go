package linthost

import "testing"

// TestRuleCorpusPlaywrightNoHooks verifies the lint rule corpus fixture playwright/no-hooks.ts.
//
// Some projects require setup to live inside tests instead of shared hooks.
// This pins Playwright hook-name detection through the generic call matcher.
//
// 1. Load a beforeEach hook.
// 2. Enable playwright/no-hooks from the annotated expect comment.
// 3. Assert the hook call is reported.
func TestRuleCorpusPlaywrightNoHooks(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-hooks.ts", `import { test } from "@playwright/test";

// expect: playwright/no-hooks error
test.beforeEach(async () => {});
`)
}
