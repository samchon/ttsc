package linthost

import "testing"

// TestRuleCorpusPlaywrightExpectExpect verifies the lint rule corpus fixture playwright/expect-expect.ts.
//
// Playwright tests without assertions can pass without checking the page state.
// This pins the SourceFile-level scan that finds a test callback and verifies it
// contains an expect call before the callback returns.
//
// 1. Load a Playwright test body with no assertion.
// 2. Enable playwright/expect-expect from the annotated expect comment.
// 3. Assert the native Engine reports the unasserted test call.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an assertion-free test callback is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/expect-expect diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A test with a real expect assertion must be accepted; visiting a page alone does not assert its state. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightExpectExpect is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightExpectExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-expect-expect.ts", `import { test } from "@playwright/test";

// expect: playwright/expect-expect error
test("loads page", async ({ page }) => {
  await page.goto("/");
});
`)
  assertRuleSkipsSource(t, "playwright/expect-expect", "import { test, expect } from \"@playwright/test\"; test(\"asserts\", async () => { expect(1).toBe(1); });\n")
}
