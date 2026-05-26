package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsDisableEnablePairReportsUnpairedDisable verifies disable/enable pairing.
//
// Range disables should be local exceptions rather than file-tail switches. This
// rule catches a disable that reaches the end of the file without a matching
// enable directive.
//
//  1. Parse a range `eslint-disable no-var` directive with no later enable.
//  2. Enable `eslint-comments/disable-enable-pair`.
//  3. Assert the unpaired disable directive is reported once.
func TestESLintCommentsDisableEnablePairReportsUnpairedDisable(t *testing.T) {
  file := parseTS(t, `
    /* eslint-disable no-var */
    var value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "eslint-comments/disable-enable-pair": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  if got := findingRules(findings); len(got) != 1 || got[0] != "eslint-comments/disable-enable-pair" {
    t.Fatalf("want one disable-enable-pair finding, got %v", got)
  }
}
