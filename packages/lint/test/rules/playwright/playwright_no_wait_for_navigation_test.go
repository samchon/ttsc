package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForNavigation verifies the lint rule corpus fixture playwright/no-wait-for-navigation.ts.
//
// waitForNavigation is racy compared with URL or web-first waits. This pins the
// page.waitForNavigation call matcher.
//
// 1. Load a Playwright test that waits for navigation.
// 2. Enable playwright/no-wait-for-navigation from the annotated expect comment.
// 3. Assert page.waitForNavigation is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.waitForNavigation is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-wait-for-navigation diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases waitForURL is the accepted targeted navigation wait. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoWaitForNavigation is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoWaitForNavigation(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-navigation.ts", `import { test } from "@playwright/test";

test("waits for navigation", async ({ page }) => {
  // expect: playwright/no-wait-for-navigation error
  await page.waitForNavigation();
});
`)
  assertRuleSkipsSource(t, "playwright/no-wait-for-navigation", "import { test } from \"@playwright/test\"; test(\"url\", async ({ page }) => { await page.waitForURL(\"/done\"); });\n")
}
