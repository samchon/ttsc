package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleCorpusPlaywrightNoForceOptionIgnoresNonPlaywrightOptions verifies the lint rule corpus fixture playwright/no-force-option-non-playwright.ts.
//
// Generic configuration objects can legitimately use a force flag. This pins
// the regression where every call with `{ force: true }` was reported even when
// the call was not a Playwright action method.
//
// 1. Load a non-Playwright configure call with a force option.
// 2. Run only playwright/no-force-option.
// 3. Assert no findings are reported.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies configure({ force: true }) remains free of Playwright findings; the zero-finding assertion prevents option-name-only false positives.
// @evidence contracts/testing.md#independent-expectations The authored configure function is outside the playwright/no-force-option API contract even though its option spelling overlaps; zero findings follow from that ownership distinction.
// @evidence contracts/testing.md#distinguishing-cases The same option name on an unrelated function must stay accepted; TestRuleCorpusPlaywrightNoForceOption owns locator actions.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoForceOptionIgnoresNonPlaywrightOptions parses a virtual TypeScript source and calls the actual engine in the shared Go unit process; no Playwright runtime or product child is launched.
func TestRuleCorpusPlaywrightNoForceOptionIgnoresNonPlaywrightOptions(t *testing.T) {
  source := `function configure(options: { force: boolean }) {
  return options;
}

configure({ force: true });
`
  file := parseTSFile(t, "/virtual/playwright-no-force-option-non-playwright.ts", source)
  findings := NewEngine(RuleConfig{"playwright/no-force-option": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected no findings, got %+v", normalizeRuleFindings(file, findings))
  }
}
