package linthost

import "testing"

// TestRuleCorpusPlaywrightNoForceOption verifies the lint rule corpus fixture playwright/no-force-option.ts.
//
// The force option bypasses Playwright actionability checks and makes tests less
// representative of user behavior. This pins detection of object options with
// `force: true`.
//
// 1. Load a locator action with the force option enabled.
// 2. Enable playwright/no-force-option from the annotated expect comment.
// 3. Assert the force property is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a locator click with force true is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-force-option diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases force false keeps actionability checks enabled; unrelated configure options belong to the separate non-Playwright regression. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoForceOption is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoForceOption(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-force-option.ts", `import { test } from "@playwright/test";

test("forces click", async ({ page }) => {
  // expect: playwright/no-force-option error
  await page.getByRole("button").click({ force: true });
});
`)
  assertRuleSkipsSource(t, "playwright/no-force-option", "import { test } from \"@playwright/test\"; test(\"normal\", async ({ page }) => { await page.getByRole(\"button\").click({ force: false }); });\n")
}
