package linthost

import "testing"

// TestRuleCorpusPlaywrightNoDuplicateSlow verifies the lint rule corpus fixture playwright/no-duplicate-slow.ts.
//
// Repeating test.slow() is redundant and can mask copy-paste mistakes. This
// pins the callback-local counter that reports only the second slow marker.
//
// 1. Load a Playwright test callback with two test.slow() calls.
// 2. Enable playwright/no-duplicate-slow from the annotated expect comment.
// 3. Assert the duplicate slow marker is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies only the second slow marker in one callback is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-duplicate-slow diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A singleton slow marker does not repeat a callback annotation. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoDuplicateSlow is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoDuplicateSlow(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-duplicate-slow.ts", `import { test } from "@playwright/test";

test("marks slow twice", async () => {
  test.slow();
  // expect: playwright/no-duplicate-slow error
  test.slow();
});
`)
  assertRuleSkipsSource(t, "playwright/no-duplicate-slow", "import { test } from \"@playwright/test\"; test(\"once\", () => { test.slow(); });\n")
}
