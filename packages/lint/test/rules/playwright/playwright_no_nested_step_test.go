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
func TestRuleCorpusPlaywrightNoNestedStep(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-nested-step.ts", `import { test } from "@playwright/test";

test("steps", async () => {
  await test.step("outer", async () => {
    // expect: playwright/no-nested-step error
    await test.step("inner", async () => {});
  });
});
`)
}
