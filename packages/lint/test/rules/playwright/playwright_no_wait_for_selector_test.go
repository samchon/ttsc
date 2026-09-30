package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForSelector verifies the lint rule corpus fixture playwright/no-wait-for-selector.ts.
//
// Selector waits are less expressive than locators and web-first assertions.
// This pins the page.waitForSelector call matcher.
//
// 1. Load a Playwright test that waits for a selector.
// 2. Enable playwright/no-wait-for-selector from the annotated expect comment.
// 3. Assert page.waitForSelector is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.waitForSelector is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-wait-for-selector diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Locator lookup avoids the discouraged selector wait. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoWaitForSelector is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoWaitForSelector(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-selector.ts", `import { test } from "@playwright/test";

test("waits for selector", async ({ page }) => {
  // expect: playwright/no-wait-for-selector error
  await page.waitForSelector("button");
});
`)
  assertRuleSkipsSource(t, "playwright/no-wait-for-selector", "import { test } from \"@playwright/test\"; test(\"locator\", ({ page }) => { page.getByRole(\"button\"); });\n")
}
