package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestESLintCommentsLineDisableInsideRangeReportsDuplicateAndUnused verifies range-aware line disable accounting.
//
// A line-scoped disable inside an active range does not suppress anything new.
// The comments rules must analyze the active range state when checking the line
// directive; otherwise it looks used merely because the target line has a raw
// finding that the range already suppressed.
//
//  1. Disable `no-var` with a range `eslint-disable`.
//  2. Add `eslint-disable-next-line no-var` before a `var` statement in that range.
//  3. Assert the line disable is reported as both duplicate and unused.
func TestESLintCommentsLineDisableInsideRangeReportsDuplicateAndUnused(t *testing.T) {
  file := parseTS(t, `
    /* eslint-disable no-var */
    // eslint-disable-next-line no-var
    var value = 1;
  `)
  findings := NewEngine(RuleConfig{
    "no-var":                               SeverityError,
    "eslint-comments/no-duplicate-disable": SeverityError,
    "eslint-comments/no-unused-disable":    SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  want := []ruleExpectation{
    {Rule: "eslint-comments/no-duplicate-disable", Severity: SeverityError, Line: 3},
    {Rule: "eslint-comments/no-unused-disable", Severity: SeverityError, Line: 3},
  }
  got := normalizeRuleFindings(file, findings)
  if len(got) != len(want) {
    t.Fatalf("want duplicate and unused disable findings, got %v", got)
  }
  for i := range want {
    if got[i] != want[i] {
      t.Fatalf("finding %d: want %+v, got %+v; all findings=%+v", i, want[i], got[i], got)
    }
  }
}
