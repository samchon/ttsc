package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixSkipsNilNode verifies the nil-node guard
// at `rule.Context.ReportFix`.
//
// The host nil-checks the node before any reporter callback. A contributor
// that mistakenly passes nil (e.g., from a guarded `*ParameterDeclaration`
// pointer) must NOT see panics or spurious diagnostics — the guard at
// `rule.go::ReportFix` is the last line of defense before the reporter.
//
// 1. Construct a Context with a FixReporter-implementing reporter.
// 2. Call `ReportFix(nil, "msg", edit)`.
// 3. Assert no reporter method fired and no panic occurred.
func TestPublicRuleContextReportFixSkipsNilNode(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  ctx.ReportFix(nil, "msg", rule.TextEdit{Pos: 0, End: 1, Text: "x"})
  if reporter.reports != 0 || reporter.ranges != 0 ||
    reporter.fixCalls != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("nil node should drop the call silently, got reports=%d ranges=%d fix=%d rangefix=%d",
      reporter.reports, reporter.ranges, reporter.fixCalls, reporter.rangeFixCall)
  }
}
