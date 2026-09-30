package linthost

import "testing"

// TestRuleCorpusPlaywrightRequireToThrowMessage verifies the lint rule corpus fixture playwright/require-to-throw-message.ts.
//
// toThrow without an expected message can pass for the wrong error. This pins
// the zero-argument matcher branch.
//
// 1. Load an expect(...).toThrow() call with no expected message.
// 2. Enable playwright/require-to-throw-message from the annotated expect comment.
// 3. Assert the toThrow call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies toThrow with no message is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/require-to-throw-message diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An explicit message distinguishes the intended error. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightRequireToThrowMessage is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightRequireToThrowMessage(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-require-to-throw-message.ts", `import { test, expect } from "@playwright/test";

test("throws", async () => {
  // expect: playwright/require-to-throw-message error
  expect(() => {
    throw new Error("boom");
  }).toThrow();
});
`)
  assertRuleSkipsSource(t, "playwright/require-to-throw-message", "import { test, expect } from \"@playwright/test\"; test(\"message\", () => { expect(() => { throw new Error(\"boom\"); }).toThrow(\"boom\"); });\n")
}
