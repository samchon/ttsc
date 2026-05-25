package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoUnlimitedDisableReportsAllRulesDisable verifies unlimited disable detection.
//
// A directive without a rule list suppresses every active rule. The hygiene rule
// must still report that directive instead of letting the directive suppress the
// hygiene diagnostic about itself.
//
//  1. Enable `eslint-comments/no-unlimited-disable`.
//  2. Parse an `eslint-disable-next-line` comment with no rule list.
//  3. Assert the unlimited disable directive is reported once.
func TestESLintCommentsNoUnlimitedDisableReportsAllRulesDisable(t *testing.T) {
  file := parseTS(t, `
    // eslint-disable-next-line
    var value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/no-unlimited-disable": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-unlimited-disable" {
    t.Fatalf("want one no-unlimited-disable finding, got %v", got)
  }
}
