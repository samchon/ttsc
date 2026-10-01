package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportFix with no edits invokes ordinary Report once with the original node/message and never invokes the available FixReporter.
// @evidence contracts/testing.md#independent-expectations An empty edit group supplies a diagnostic without an autofix. Literal msg, parsed node identity and authored callback counts define the expected downgrade independently of reporter output.
// @evidence contracts/testing.md#distinguishing-cases The reporter supports fix capability, so the ordinary route is caused specifically by zero edits rather than a legacy host; the adjacent nonempty-edit unit proves the same reporter can receive a fix.
// @evidence contracts/testing.md#execution-ownership Direct public Context delegation runs in-process with an observing reporter and a real parsed node; no internal host adapter, native producer, consumer install or source-layout check executes.
func TestPublicRuleContextReportFixFallsBackWhenNoEdits(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  ctx.ReportFix(node, "msg")
  if reporter.reports != 1 {
    t.Fatalf("Report should fire once for zero-edit ReportFix, got %d", reporter.reports)
  }
  if reporter.fixCalls != 0 || reporter.ranges != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("FixReporter.ReportFix should not fire for zero-edit calls, got %d", reporter.fixCalls)
  }
  if reporter.lastNode != node || reporter.lastMessage != "msg" { t.Fatalf("fallback diagnostic payload lost: %+v", reporter) }
}
