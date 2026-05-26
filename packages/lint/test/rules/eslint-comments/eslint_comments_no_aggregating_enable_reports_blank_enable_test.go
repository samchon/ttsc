package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoAggregatingEnableReportsBlankEnable verifies aggregating enable detection.
//
// A blank `eslint-enable` after named disables re-enables more than the comment
// spells out. The rule keeps the enable side as explicit as the disable side.
//
//  1. Disable two named rules with range directives.
//  2. Re-enable them with a bare `eslint-enable`.
//  3. Assert the aggregating enable directive is reported once.
func TestESLintCommentsNoAggregatingEnableReportsBlankEnable(t *testing.T) {
  file := parseTS(t, `
    /* eslint-disable no-var */
    /* eslint-disable no-console */
    /* eslint-enable */
    let value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/no-aggregating-enable": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-aggregating-enable" {
    t.Fatalf("want one no-aggregating-enable finding, got %v", got)
  }
}
