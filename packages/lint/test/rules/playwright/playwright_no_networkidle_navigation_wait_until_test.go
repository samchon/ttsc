package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNetworkidleNavigationWaitUntil verifies the lint rule corpus fixture playwright/no-networkidle-navigation-wait-until.ts.
//
// Navigation APIs accept waitUntil options in method-specific argument slots.
// This pins the narrowed branch so page.goto still reports networkidle while
// unrelated option objects are ignored.
//
// 1. Load a page.goto call with waitUntil set to networkidle.
// 2. Enable playwright/no-networkidle from the annotated expect comment.
// 3. Assert the networkidle literal is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies networkidle in page.goto options is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-networkidle diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases The load navigation state is the accepted adjacent option; unrelated calls have a separate regression. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoNetworkidleNavigationWaitUntil is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoNetworkidleNavigationWaitUntil(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-networkidle-navigation-wait-until.ts", `import { test } from "@playwright/test";

test("navigates", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.goto("/", { waitUntil: "networkidle" });
});
`)
  assertRuleSkipsSource(t, "playwright/no-networkidle", "import { test } from \"@playwright/test\"; test(\"load\", async ({ page }) => { await page.goto(\"/\", { waitUntil: \"load\" }); });\n")
}
