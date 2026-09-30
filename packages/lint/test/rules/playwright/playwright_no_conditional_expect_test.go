package linthost

import "testing"

// TestRuleCorpusPlaywrightNoConditionalExpect verifies the lint rule corpus fixture playwright/no-conditional-expect.ts.
//
// Conditional assertions hide coverage when the branch is not taken. This pins
// the ancestor walk from an expect call to an enclosing conditional inside a
// Playwright test body.
//
// 1. Load a Playwright test with an expect call under an if statement.
// 2. Enable playwright/no-conditional-expect from the annotated expect comment.
// 3. Assert the conditional expect call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies expect under an if branch is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-conditional-expect diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An unconditional expect inside a test remains valid. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoConditionalExpect is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoConditionalExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-conditional-expect.ts", `import { test, expect } from "@playwright/test";

test("checks conditionally", async ({ page }) => {
  if (await page.isVisible("main")) {
    // expect: playwright/no-conditional-expect error
    expect(page.url()).toContain("home");
  }
});
`)
  assertRuleSkipsSource(t, "playwright/no-conditional-expect", "import { test, expect } from \"@playwright/test\"; test(\"always\", () => { expect(1).toBe(1); });\n")
}
