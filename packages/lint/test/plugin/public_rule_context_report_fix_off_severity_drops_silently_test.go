package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixOffSeverityDropsSilently verifies the
// severity gate on ReportFix and ReportRangeFix.
//
// The engine pre-filters by severity, but `Context.ReportFix` and
// `Context.ReportRangeFix` carry the same gate as a defensive belt to
// keep contributor tests stable when they instantiate a Context with
// `SeverityOff` directly. A regression in the gate would cause off-rules
// to leak edits into the cascade.
//
// 1. Construct a Context with Severity=SeverityOff.
// 2. Call ReportFix and ReportRangeFix with edits.
// 3. Assert no reporter callback fired.
func TestPublicRuleContextReportFixOffSeverityDropsSilently(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityOff, reporter)
  ctx.ReportFix(newDummyNode(t), "msg", rule.TextEdit{Pos: 0, End: 1, Text: ""})
  ctx.ReportRangeFix(1, 4, "msg", rule.TextEdit{Pos: 1, End: 4, Text: ""})
  if reporter.reports != 0 || reporter.ranges != 0 ||
    reporter.fixCalls != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("SeverityOff should drop every report path, got reports=%d ranges=%d fix=%d rangefix=%d",
      reporter.reports, reporter.ranges, reporter.fixCalls, reporter.rangeFixCall)
  }
}
