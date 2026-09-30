package linthost

import "testing"

// TestRuleCorpusPlaywrightNoPagePause verifies the lint rule corpus fixture playwright/no-page-pause.ts.
//
// page.pause() is a debugging helper that should not remain in committed test
// sources. This pins the direct page.pause call-chain path.
//
// 1. Load a Playwright test that calls page.pause().
// 2. Enable playwright/no-page-pause from the annotated expect comment.
// 3. Assert the pause call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.pause is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-page-pause diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A normal page.goto call is not a debugging pause. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoPagePause is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoPagePause(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-page-pause.ts", `import { test } from "@playwright/test";

test("debugs page", async ({ page }) => {
  // expect: playwright/no-page-pause error
  await page.pause();
});
`)
  assertRuleSkipsSource(t, "playwright/no-page-pause", "import { test } from \"@playwright/test\"; test(\"navigate\", async ({ page }) => { await page.goto(\"/\"); });\n")
}
