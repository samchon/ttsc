package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferToHaveLength verifies the lint rule corpus fixture playwright/prefer-to-have-length.ts.
//
// Length assertions use the dedicated generic matcher. The original synthetic
// locator-shaped source pins the lint branch, not a supported browser API call.
//
// 1. Load an expect(await collection.length()).toBe(...) assertion.
// 2. Enable playwright/prefer-to-have-length from the annotated expect comment.
// 3. Assert the matcher call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toBe over awaited length() is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/prefer-to-have-length diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases toHaveLength on an array expresses length directly without the awaited accessor. The original synthetic reported fixture and this valid generic matcher control both execute; no Locator.length or Locator.toHaveLength runtime support is claimed.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightPreferToHaveLength is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightPreferToHaveLength(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-to-have-length.ts", `import { test, expect } from "@playwright/test";

test("checks length", async ({ page }) => {
  const collection = page.locator("li");
  // expect: playwright/prefer-to-have-length error
  expect(await collection.length()).toBe(2);
});
`)
  assertRuleSkipsSource(t, "playwright/prefer-to-have-length", "import { test, expect } from \"@playwright/test\"; test(\"length\", () => { expect([1, 2]).toHaveLength(2); });\n")
}
