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
