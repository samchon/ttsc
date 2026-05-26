package linthost

import "testing"

// TestRuleCorpusPlaywrightNoSlowedTest verifies the lint rule corpus fixture playwright/no-slowed-test.ts.
//
// Slow markers can hide test performance regressions. This pins detection of a
// top-level test.slow() call.
//
// 1. Load a Playwright slow marker.
// 2. Enable playwright/no-slowed-test from the annotated expect comment.
// 3. Assert the slow marker is reported.
func TestRuleCorpusPlaywrightNoSlowedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-slowed-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-slowed-test error
test.slow();
`)
}
