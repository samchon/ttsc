package linthost

import "testing"

// TestRuleCorpusPlaywrightNoHooks verifies the lint rule corpus fixture playwright/no-hooks.ts.
//
// Some projects require setup to live inside tests instead of shared hooks.
// This pins Playwright hook-name detection through the generic call matcher.
//
// 1. Load a beforeEach hook.
// 2. Enable playwright/no-hooks from the annotated expect comment.
// 3. Assert the hook call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies beforeEach is reported when hooks are forbidden; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-hooks diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Inline setup inside a test is not a shared hook. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoHooks is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoHooks(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-hooks.ts", `import { test } from "@playwright/test";

// expect: playwright/no-hooks error
test.beforeEach(async () => {});
`)
  assertRuleSkipsSource(t, "playwright/no-hooks", "import { test } from \"@playwright/test\"; test(\"inline\", () => {});\n")
}
