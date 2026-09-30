package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNthMethods verifies the lint rule corpus fixture playwright/no-nth-methods.ts.
//
// Positional locator methods couple tests to document order. This pins the
// final-method check for nth locator calls.
//
// 1. Load a locator.nth call.
// 2. Enable playwright/no-nth-methods from the annotated expect comment.
// 3. Assert the positional locator method is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies nth(0) is reported as a positional locator; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-nth-methods diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A role locator without a positional method remains accepted. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoNthMethods is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoNthMethods(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-nth-methods.ts", `import { test } from "@playwright/test";

test("uses position", async ({ page }) => {
  // expect: playwright/no-nth-methods error
  page.getByRole("button").nth(0);
});
`)
  assertRuleSkipsSource(t, "playwright/no-nth-methods", "import { test } from \"@playwright/test\"; test(\"role\", ({ page }) => { page.getByRole(\"button\"); });\n")
}
