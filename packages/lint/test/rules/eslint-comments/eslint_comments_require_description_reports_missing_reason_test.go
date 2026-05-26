package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsRequireDescriptionReportsMissingReason verifies directive descriptions.
//
// Directive comments should carry the local reason for the exception. The rule
// uses the existing `-- description` split point so rule parsing and description
// parsing stay aligned.
//
//  1. Enable `eslint-comments/require-description`.
//  2. Parse a directive with a rule list but no `--` description.
//  3. Assert the missing description is reported once.
func TestESLintCommentsRequireDescriptionReportsMissingReason(t *testing.T) {
  file := parseTS(t, `
    // eslint-disable-next-line no-var
    var value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/require-description": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/require-description" {
    t.Fatalf("want one require-description finding, got %v", got)
  }
}
