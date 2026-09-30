package linthost

import "testing"

// TestRuleCorpusPlaywrightValidTitle verifies the lint rule corpus fixture playwright/valid-title.ts.
//
// Empty titles make reports hard to interpret. This pins the non-empty string
// validation for Playwright test titles.
//
// 1. Load a Playwright test with an empty title.
// 2. Enable playwright/valid-title from the annotated expect comment.
// 3. Assert the test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an empty title is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/valid-title diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A nonempty string title names a valid test. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightValidTitle is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightValidTitle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-title.ts", `import { test } from "@playwright/test";

// expect: playwright/valid-title error
test("", async () => {});
`)
  assertRuleSkipsSource(t, "playwright/valid-title", "import { test } from \"@playwright/test\"; test(\"named\", () => {});\n")
}
