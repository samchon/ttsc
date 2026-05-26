package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNetworkidle verifies the lint rule corpus fixture playwright/no-networkidle.ts.
//
// The networkidle state is discouraged because it couples tests to background
// traffic. This pins the direct waitForLoadState("networkidle") call shape.
//
// 1. Load a page wait using the networkidle load state.
// 2. Enable playwright/no-networkidle from the annotated expect comment.
// 3. Assert the networkidle literal is reported.
func TestRuleCorpusPlaywrightNoNetworkidle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-networkidle.ts", `import { test } from "@playwright/test";

test("waits for network", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.waitForLoadState("networkidle");
});
`)
}
