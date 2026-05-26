package linthost

import "testing"

// TestRuleCorpusPlaywrightValidDescribeCallback verifies the lint rule corpus fixture playwright/valid-describe-callback.ts.
//
// Playwright describe callbacks must be synchronous so test registration is
// deterministic. This pins the async callback branch.
//
// 1. Load a test.describe call with an async callback.
// 2. Enable playwright/valid-describe-callback from the annotated expect comment.
// 3. Assert the invalid callback is reported.
func TestRuleCorpusPlaywrightValidDescribeCallback(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-describe-callback.ts", `import { test } from "@playwright/test";

// expect: playwright/valid-describe-callback error
test.describe("suite", async () => {});
`)
}
