package linthost

import "testing"

// TestRuleCorpusPlaywrightNoGetByTitle verifies the lint rule corpus fixture playwright/no-get-by-title.ts.
//
// The locator policy prefers role-based queries over tooltip metadata. This
// pins the getByTitle diagnostic without claiming browser accessibility results.
//
// 1. Load a Playwright locator lookup by title.
// 2. Enable playwright/no-get-by-title from the annotated expect comment.
// 3. Assert the getByTitle call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies getByTitle is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-get-by-title diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Role lookup uses the supported accessible locator form. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoGetByTitle is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoGetByTitle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-get-by-title.ts", `import { test } from "@playwright/test";

test("uses title", async ({ page }) => {
  // expect: playwright/no-get-by-title error
  page.getByTitle("Settings");
});
`)
  assertRuleSkipsSource(t, "playwright/no-get-by-title", "import { test } from \"@playwright/test\"; test(\"role\", ({ page }) => { page.getByRole(\"button\"); });\n")
}
