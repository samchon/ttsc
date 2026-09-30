package linthost

import "testing"

// TestRuleCorpusPlaywrightRequireToPassTimeout verifies the lint rule corpus fixture playwright/require-to-pass-timeout.ts.
//
// toPass without an explicit timeout can wait longer than intended. This pins
// the options-object check for missing timeout.
//
// 1. Load an expect(...).toPass() call with no options.
// 2. Enable playwright/require-to-pass-timeout from the annotated expect comment.
// 3. Assert the toPass call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toPass with no options is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/require-to-pass-timeout diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An explicit timeout bounds the retry interval. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightRequireToPassTimeout is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightRequireToPassTimeout(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-require-to-pass-timeout.ts", `import { test, expect } from "@playwright/test";

test("passes eventually", async () => {
  // expect: playwright/require-to-pass-timeout error
  await expect(async () => {}).toPass();
});
`)
  assertRuleSkipsSource(t, "playwright/require-to-pass-timeout", "import { test, expect } from \"@playwright/test\"; test(\"bounded\", async () => { await expect(async () => {}).toPass({ timeout: 1000 }); });\n")
}
