package linthost

import "testing"

// TestRuleCorpusPlaywrightValidExpect verifies the lint rule corpus fixture playwright/valid-expect.ts.
//
// Playwright expect must receive exactly one actual value. This pins the
// argument-count check for empty expect calls.
//
// 1. Load an expect call with no arguments.
// 2. Enable playwright/valid-expect from the annotated expect comment.
// 3. Assert the invalid expect call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies expect with zero arguments is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/valid-expect diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Exactly one actual value satisfies the argument-count contract. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightValidExpect is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightValidExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-expect.ts", `import { test, expect } from "@playwright/test";

test("expects", async () => {
  // expect: playwright/valid-expect error
  expect();
});
`)
  assertRuleSkipsSource(t, "playwright/valid-expect", "import { test, expect } from \"@playwright/test\"; test(\"value\", () => { expect(1).toBe(1); });\n")
}
