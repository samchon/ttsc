package linthost

import "testing"

// TestRuleCorpusPlaywrightNoSlowedTest verifies the lint rule corpus fixture playwright/no-slowed-test.ts.
//
// Slow markers can hide test performance regressions. This pins detection of a
// top-level test.slow() call.
//
// 1. Load a Playwright slow marker.
// 2. Enable playwright/no-slowed-test from the annotated expect comment.
// 3. Assert the slow marker is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the standalone test.slow marker is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-slowed-test diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An ordinary test without a slow marker remains accepted. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoSlowedTest is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoSlowedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-slowed-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-slowed-test error
test.slow();
`)
  assertRuleSkipsSource(t, "playwright/no-slowed-test", "import { test } from \"@playwright/test\"; test(\"ordinary\", () => {});\n")
}
