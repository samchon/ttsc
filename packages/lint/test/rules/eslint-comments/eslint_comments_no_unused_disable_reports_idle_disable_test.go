package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoUnusedDisableReportsIdleDisable verifies unused disable detection.
//
// The rule must inspect raw rule findings before directive filtering; otherwise a
// disable that never suppresses anything would be indistinguishable from one that
// correctly hid a target diagnostic.
//
//  1. Enable `no-var` and `eslint-comments/no-unused-disable`.
//  2. Put `eslint-disable-next-line no-var` before a `let` declaration.
//  3. Assert the idle directive is reported once.
func TestESLintCommentsNoUnusedDisableReportsIdleDisable(t *testing.T) {
  file := parseTS(t, `
    // eslint-disable-next-line no-var
    let value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "no-var":                            SeverityError,
    "eslint-comments/no-unused-disable": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-unused-disable" {
    t.Fatalf("want one no-unused-disable finding, got %v", got)
  }
}
