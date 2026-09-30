package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportRangeFix with zero edits invokes ordinary ReportRange once, retaining literal diagnostic coordinates 1..4 and msg while bypassing the available range-fix callback.
// @evidence contracts/testing.md#independent-expectations No candidate edits means a diagnostic-only report, even on a fix-capable host. Literal range/message and callback counts specify the independent expected downgrade rather than reading an expected payload from the invoked reporter.
// @evidence contracts/testing.md#distinguishing-cases A capable reporter isolates the zero-edit branch from legacy capability absence; the neighboring nonempty edit case supplies the positive range-fix control. Both fallback count and retained payload are checked.
// @evidence contracts/testing.md#execution-ownership The real public context and observing reporter operate directly in the shared Go process on authored ranges, without node construction, native builds, installation, child processes or repository layout checks.
func TestPublicRuleContextReportRangeFixFallsBackWhenNoEdits(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  ctx.ReportRangeFix(1, 4, "msg")
  if reporter.ranges != 1 {
    t.Fatalf("ReportRange should fire once for zero-edit call, got %d", reporter.ranges)
  }
  if reporter.rangeFixCall != 0 || reporter.reports != 0 || reporter.fixCalls != 0 {
    t.Fatalf("FixReporter.ReportRangeFix should not fire for zero-edit calls, got %d", reporter.rangeFixCall)
  }
  if reporter.lastPos != 1 || reporter.lastEnd != 4 || reporter.lastMessage != "msg" { t.Fatalf("range fallback payload lost: %+v", reporter) }
}
