package linthost

import "testing"

// TestRuleCorpusPlaywrightNoStandaloneExpect verifies the lint rule corpus fixture playwright/no-standalone-expect.ts.
//
// Assertions outside Playwright tests do not belong to a test result. This pins
// the nearest test-like ancestor check for expect calls.
//
// 1. Load a top-level expect call.
// 2. Enable playwright/no-standalone-expect from the annotated expect comment.
// 3. Assert the standalone assertion is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a top-level expect is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-standalone-expect diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases The same assertion inside a test callback belongs to a test result. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoStandaloneExpect is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoStandaloneExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-standalone-expect.ts", `import { expect } from "@playwright/test";

// expect: playwright/no-standalone-expect error
expect(1).toBe(1);
`)
  assertRuleSkipsSource(t, "playwright/no-standalone-expect", "import { test, expect } from \"@playwright/test\"; test(\"owned\", () => { expect(1).toBe(1); });\n")
}
