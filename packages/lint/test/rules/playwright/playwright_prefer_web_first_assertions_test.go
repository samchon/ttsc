package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferWebFirstAssertions verifies the lint rule corpus fixture playwright/prefer-web-first-assertions.ts.
//
// Awaiting locator state before a generic matcher loses Playwright's built-in
// retry loop. This pins the high-confidence `expect(await locator.isVisible())`
// pattern.
//
// 1. Load a Playwright assertion over an awaited locator state call.
// 2. Enable playwright/prefer-web-first-assertions from the annotated expect comment.
// 3. Assert the generic matcher call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toBe over awaited isVisible() is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/prefer-web-first-assertions diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases toBeVisible preserves the locator assertion form. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightPreferWebFirstAssertions is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightPreferWebFirstAssertions(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-web-first-assertions.ts", `import { test, expect } from "@playwright/test";

test("checks visibility", async ({ page }) => {
  const submit = page.getByRole("button");
  // expect: playwright/prefer-web-first-assertions error
  expect(await submit.isVisible()).toBe(true);
});
`)
  assertRuleSkipsSource(t, "playwright/prefer-web-first-assertions", "import { test, expect } from \"@playwright/test\"; test(\"visible\", async ({ page }) => { await expect(page.getByRole(\"button\")).toBeVisible(); });\n")
}
