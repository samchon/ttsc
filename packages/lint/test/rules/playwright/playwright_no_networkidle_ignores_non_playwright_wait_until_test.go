package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRuleCorpusPlaywrightNoNetworkidleIgnoresNonPlaywrightWaitUntil verifies the lint rule corpus fixture playwright/no-networkidle-non-playwright.ts.
//
// Non-Playwright configuration APIs can use a waitUntil option with their own
// semantics. This pins the regression where any call carrying
// `{ waitUntil: "networkidle" }` was reported.
//
// 1. Load a non-Playwright configure call with a networkidle waitUntil option.
// 2. Run only playwright/no-networkidle.
// 3. Assert no findings are reported.
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
