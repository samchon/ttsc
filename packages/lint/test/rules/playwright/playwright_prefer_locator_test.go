package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferLocator verifies the lint rule corpus fixture playwright/prefer-locator.ts.
//
// Page selector action APIs are weaker than locator-based actions. This pins
// the page method table used by prefer-locator.
//
// 1. Load a page.click selector action.
// 2. Enable playwright/prefer-locator from the annotated expect comment.
// 3. Assert the page action is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.click with a selector is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/prefer-locator diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A role locator click uses the preferred locator API. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightPreferLocator is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightPreferLocator(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-locator.ts", `import { test } from "@playwright/test";

test("clicks selector", async ({ page }) => {
  // expect: playwright/prefer-locator error
  await page.click("button");
});
`)
  assertRuleSkipsSource(t, "playwright/prefer-locator", "import { test } from \"@playwright/test\"; test(\"locator\", async ({ page }) => { await page.getByRole(\"button\").click(); });\n")
}
