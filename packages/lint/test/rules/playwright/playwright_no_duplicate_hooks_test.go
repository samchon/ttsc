package linthost

import "testing"

// TestRuleCorpusPlaywrightNoDuplicateHooks verifies the lint rule corpus fixture playwright/no-duplicate-hooks.ts.
//
// Repeating the same hook in a file makes setup order harder to reason about.
// This pins the per-hook seen map used by the rule.
//
// 1. Load two beforeEach hooks in the same source file.
// 2. Enable playwright/no-duplicate-hooks from the annotated expect comment.
// 3. Assert the second hook is reported.
func TestRuleCorpusPlaywrightNoDuplicateHooks(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-duplicate-hooks.ts", `import { test } from "@playwright/test";

test.beforeEach(async () => {});

// expect: playwright/no-duplicate-hooks error
test.beforeEach(async () => {});
`)
}
