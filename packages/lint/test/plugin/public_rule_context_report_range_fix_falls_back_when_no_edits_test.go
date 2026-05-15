package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportRangeFixFallsBackWhenNoEdits verifies the
// zero-edit branch of the range-anchored fix entry point.
//
// Sibling to TestPublicRuleContextReportFixFallsBackWhenNoEdits. A
// contributor that builds a range-based diagnostic and computes an edit
// list whose length turns out to be zero should produce only the
// diagnostic, never the empty fix.
//
// 1. Construct a Context whose reporter implements both Reporter and FixReporter.
// 2. Call `ReportRangeFix(pos, end, msg)` with no edits.
// 3. Assert ReportRange fired and FixReporter.ReportRangeFix did not.
func TestPublicRuleContextReportRangeFixFallsBackWhenNoEdits(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  ctx.ReportRangeFix(1, 4, "msg")
  if reporter.ranges != 1 {
    t.Fatalf("ReportRange should fire once for zero-edit call, got %d", reporter.ranges)
  }
  if reporter.rangeFixCall != 0 {
    t.Fatalf("FixReporter.ReportRangeFix should not fire for zero-edit calls, got %d", reporter.rangeFixCall)
  }
}
