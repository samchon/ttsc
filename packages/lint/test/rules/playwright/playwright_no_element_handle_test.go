package linthost

import "testing"

// TestRuleCorpusPlaywrightNoElementHandle verifies the lint rule corpus fixture playwright/no-element-handle.ts.
//
// ElementHandle APIs are discouraged because locators retry and stay closer to
// user-facing behavior. This pins the page.$ call shape covered by the rule.
//
// 1. Load a Playwright test that reads an ElementHandle with page.$.
// 2. Enable playwright/no-element-handle from the annotated expect comment.
// 3. Assert the ElementHandle helper call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.$ produces the discouraged ElementHandle diagnostic; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-element-handle diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Locator lookup avoids the ElementHandle API. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoElementHandle is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoElementHandle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-element-handle.ts", `import { test } from "@playwright/test";

test("gets a handle", async ({ page }) => {
  // expect: playwright/no-element-handle error
  await page.$("button");
});
`)
  assertRuleSkipsSource(t, "playwright/no-element-handle", "import { test } from \"@playwright/test\"; test(\"locator\", ({ page }) => { page.getByRole(\"button\"); });\n")
}
