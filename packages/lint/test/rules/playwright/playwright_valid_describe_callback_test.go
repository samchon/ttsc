package linthost

import "testing"

// TestRuleCorpusPlaywrightValidDescribeCallback verifies the lint rule corpus fixture playwright/valid-describe-callback.ts.
//
// Playwright describe callbacks must be synchronous so test registration is
// deterministic. This pins the async callback branch.
//
// 1. Load a test.describe call with an async callback.
// 2. Enable playwright/valid-describe-callback from the annotated expect comment.
// 3. Assert the invalid callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an async describe callback is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/valid-describe-callback diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A synchronous registration callback remains valid. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightValidDescribeCallback is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightValidDescribeCallback(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-describe-callback.ts", `import { test } from "@playwright/test";

// expect: playwright/valid-describe-callback error
test.describe("suite", async () => {});
`)
  assertRuleSkipsSource(t, "playwright/valid-describe-callback", "import { test } from \"@playwright/test\"; test.describe(\"suite\", () => {});\n")
}
