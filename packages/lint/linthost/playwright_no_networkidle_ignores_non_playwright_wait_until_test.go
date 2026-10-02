package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleCorpusPlaywrightNoNetworkidleIgnoresNonPlaywrightWaitUntil verifies that a waitUntil networkidle option on a call that is not a Playwright navigation is not reported.
//
// Non-Playwright configuration APIs can use a waitUntil option with their own
// semantics. This pins the regression where any call carrying
// `{ waitUntil: "networkidle" }` was reported.
//
// 1. Load a non-Playwright configure call with a networkidle waitUntil option.
// 2. Run only playwright/no-networkidle.
// 3. Assert no findings are reported.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies configure({ waitUntil: "networkidle" }) remains free of Playwright findings; the zero-finding assertion prevents option-name-only false positives.
// @evidence contracts/testing.md#independent-expectations The authored configure function is outside the playwright/no-networkidle API contract even though its option spelling overlaps; zero findings follow from that ownership distinction.
// @evidence contracts/testing.md#distinguishing-cases The same state string on an unrelated API must stay accepted; navigation and direct wait cases own real Playwright shapes.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoNetworkidleIgnoresNonPlaywrightWaitUntil parses a virtual TypeScript source and calls the actual engine in the shared Go unit process; no Playwright runtime or product child is launched.
func TestRuleCorpusPlaywrightNoNetworkidleIgnoresNonPlaywrightWaitUntil(t *testing.T) {
  source := `function configure(options: { waitUntil: string }) {
  return options;
}

configure({ waitUntil: "networkidle" });
`
  file := parseTSFile(t, "/virtual/playwright-no-networkidle-non-playwright.ts", source)
  findings := NewEngine(RuleConfig{"playwright/no-networkidle": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected no findings, got %+v", normalizeRuleFindings(file, findings))
  }
}
