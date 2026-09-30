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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies waitForLoadState with networkidle is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-networkidle diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases The load state does not wait for background-network quiescence. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoNetworkidle is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoNetworkidle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-networkidle.ts", `import { test } from "@playwright/test";

test("waits for network", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.waitForLoadState("networkidle");
});
`)
  assertRuleSkipsSource(t, "playwright/no-networkidle", "import { test } from \"@playwright/test\"; test(\"load\", async ({ page }) => { await page.waitForLoadState(\"load\"); });\n")
}
