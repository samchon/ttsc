package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsNoUseReportsDirectiveComment verifies directive comment bans.
//
// Some projects want lint suppressions to live in config instead of source. The
// rule reports any recognized eslint/lint directive comment without depending on
// another lint rule firing.
//
//  1. Enable `eslint-comments/no-use`.
//  2. Parse one `eslint-disable-next-line no-var` comment.
//  3. Assert the directive comment is reported once.
func TestESLintCommentsNoUseReportsDirectiveComment(t *testing.T) {
  file := parseTS(t, `
    // eslint-disable-next-line no-var
    var value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/no-use": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/no-use" {
    t.Fatalf("want one no-use finding, got %v", got)
  }
}
