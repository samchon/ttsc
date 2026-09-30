package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferToHaveCount verifies the lint rule corpus fixture playwright/prefer-to-have-count.ts.
//
// Web-first count assertions retry and produce clearer diagnostics. This pins
// the awaited count() matcher branch.
//
// 1. Load an expect(await locator.count()).toBe(...) assertion.
// 2. Enable playwright/prefer-to-have-count from the annotated expect comment.
// 3. Assert the matcher call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toBe over awaited count() is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/prefer-to-have-count diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases toHaveCount is the direct retrying count assertion. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightPreferToHaveCount is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightPreferToHaveCount(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-to-have-count.ts", `import { test, expect } from "@playwright/test";

test("counts", async ({ page }) => {
  // expect: playwright/prefer-to-have-count error
  expect(await page.locator("li").count()).toBe(2);
});
`)
  assertRuleSkipsSource(t, "playwright/prefer-to-have-count", "import { test, expect } from \"@playwright/test\"; test(\"count\", async ({ page }) => { await expect(page.locator(\"li\")).toHaveCount(2); });\n")
}
