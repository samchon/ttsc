package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportFixFallsBackWhenNoEdits verifies the zero-edit branch.
//
// `rule.Context.ReportFix` short-circuits to plain `Reporter.Report` when the
// caller passes no edits even if the host implements `FixReporter`. Without
// this branch a contributor that conditionally computes an edit slice and
// returns early would silently route through the fix path with an empty
// slice and confuse downstream cascade logic.
//
// 1. Construct a Context whose reporter implements both Reporter and FixReporter.
// 2. Call `ReportFix(node, msg)` with no edits.
// 3. Assert the plain Report path fired once and FixReporter was bypassed.
func TestPublicRuleContextReportFixFallsBackWhenNoEdits(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  ctx.ReportFix(newDummyNode(t), "msg")
  if reporter.reports != 1 {
    t.Fatalf("Report should fire once for zero-edit ReportFix, got %d", reporter.reports)
  }
  if reporter.fixCalls != 0 {
    t.Fatalf("FixReporter.ReportFix should not fire for zero-edit calls, got %d", reporter.fixCalls)
  }
}
