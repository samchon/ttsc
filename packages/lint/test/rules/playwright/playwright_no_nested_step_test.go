package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNestedStep verifies the lint rule corpus fixture playwright/no-nested-step.ts.
//
// Nested steps make reports noisy and harder to scan. This pins the ancestor
// call search that distinguishes an inner test.step from the enclosing step.
//
// 1. Load a test.step callback containing another test.step call.
// 2. Enable playwright/no-nested-step from the annotated expect comment.
// 3. Assert the inner step is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies the inner test.step is reported while its enclosing step remains clean; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-nested-step diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases One top-level step has no step ancestor. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoNestedStep is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoNestedStep(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-nested-step.ts", `import { test } from "@playwright/test";

test("steps", async () => {
  await test.step("outer", async () => {
    // expect: playwright/no-nested-step error
    await test.step("inner", async () => {});
  });
});
`)
  assertRuleSkipsSource(t, "playwright/no-nested-step", "import { test } from \"@playwright/test\"; test(\"step\", async () => { await test.step(\"one\", async () => {}); });\n")
}
