package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoUnusedEnableReportsIdleEnable verifies unused enable detection.
//
// `eslint-enable` without an active matching disable is configuration noise and
// should be reported even when no ordinary lint rule emits diagnostics in the file.
//
//  1. Enable only `eslint-comments/no-unused-enable`.
//  2. Parse a file that starts with `eslint-enable no-var`.
//  3. Assert the enable directive is reported once.
func TestESLintCommentsNoUnusedEnableReportsIdleEnable(t *testing.T) {
  file := parseTS(t, `
    /* eslint-enable no-var */
    let value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/no-unused-enable": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-unused-enable" {
    t.Fatalf("want one no-unused-enable finding, got %v", got)
  }
}
