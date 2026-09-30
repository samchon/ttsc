package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForTimeout verifies the lint rule corpus fixture playwright/no-wait-for-timeout.ts.
//
// Fixed timeouts make tests slow and flaky compared with locator assertions.
// This pins the direct page.waitForTimeout call-chain path.
//
// 1. Load a Playwright test that waits for a hard-coded timeout.
// 2. Enable playwright/no-wait-for-timeout from the annotated expect comment.
// 3. Assert the timeout call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.waitForTimeout is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-wait-for-timeout diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases URL waiting is event-based rather than a fixed sleep. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoWaitForTimeout is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoWaitForTimeout(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-timeout.ts", `import { test } from "@playwright/test";

test("waits explicitly", async ({ page }) => {
  // expect: playwright/no-wait-for-timeout error
  await page.waitForTimeout(1000);
});
`)
  assertRuleSkipsSource(t, "playwright/no-wait-for-timeout", "import { test } from \"@playwright/test\"; test(\"url\", async ({ page }) => { await page.waitForURL(\"/done\"); });\n")
}
