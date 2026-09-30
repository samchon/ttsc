package linthost

import "testing"

// TestRuleCorpusPlaywrightNoDuplicateHooks verifies the lint rule corpus fixture playwright/no-duplicate-hooks.ts.
//
// Repeating the same hook in a file makes setup order harder to reason about.
// This pins the per-hook seen map used by the rule.
//
// 1. Load two beforeEach hooks in the same source file.
// 2. Enable playwright/no-duplicate-hooks from the annotated expect comment.
// 3. Assert the second hook is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies only the second beforeEach hook is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-duplicate-hooks diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases One beforeEach and one afterEach are distinct hook kinds, not duplicates. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoDuplicateHooks is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoDuplicateHooks(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-duplicate-hooks.ts", `import { test } from "@playwright/test";

test.beforeEach(async () => {});

// expect: playwright/no-duplicate-hooks error
test.beforeEach(async () => {});
`)
  assertRuleSkipsSource(t, "playwright/no-duplicate-hooks", "import { test } from \"@playwright/test\"; test.beforeEach(async () => {}); test.afterEach(async () => {});\n")
}
