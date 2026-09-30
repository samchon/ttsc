package linthost

import "testing"

// TestRuleCorpusPlaywrightMaxExpects verifies the lint rule corpus fixture playwright/max-expects.ts.
//
// Assertion-heavy tests are harder to diagnose when they fail. This pins the
// SourceFile-level callback scan that counts expect calls inside a Playwright
// test body.
//
// 1. Load one Playwright test with six assertions.
// 2. Enable playwright/max-expects from the annotated expect comment.
// 3. Assert the test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies six expect calls exceed the default five-assertion limit; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/max-expects diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases The adjacent five-assertion callback is within the default limit. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightMaxExpects is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightMaxExpects(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-max-expects.ts", `import { test, expect } from "@playwright/test";

// expect: playwright/max-expects error
test("has many assertions", async () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});
`)
  assertRuleSkipsSource(t, "playwright/max-expects", "import { test, expect } from \"@playwright/test\"; test(\"five\", () => { expect(1).toBe(1); expect(2).toBe(2); expect(3).toBe(3); expect(4).toBe(4); expect(5).toBe(5); });\n")
}
