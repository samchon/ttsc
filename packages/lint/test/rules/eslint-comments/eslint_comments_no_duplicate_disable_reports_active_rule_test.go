package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoDuplicateDisableReportsActiveRule verifies duplicate disable detection.
//
// Re-disabling an already disabled rule cannot suppress any additional finding.
// The rule should flag the second directive while leaving the directive parser's
// normal range state intact.
//
//  1. Parse two range `eslint-disable no-var` directives.
//  2. Enable `eslint-comments/no-duplicate-disable`.
//  3. Assert the second disable directive is reported once.
func TestESLintCommentsNoDuplicateDisableReportsActiveRule(t *testing.T) {
  file := parseTS(t, `
    /* eslint-disable no-var */
    /* eslint-disable no-var */
    let value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/no-duplicate-disable": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-duplicate-disable" {
    t.Fatalf("want one no-duplicate-disable finding, got %v", got)
  }
}
