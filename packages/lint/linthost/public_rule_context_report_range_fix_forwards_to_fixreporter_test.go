package linthost

import (
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportRangeFixForwardsToFixReporter verifies range-based fix forwarding.
//
// Sibling to TestPublicRuleContextReportFixForwardsToFixReporter that pins the
// other half of the contributor fix surface: `ReportRangeFix` lets a rule
// emit an edit anchored to an explicit byte range instead of a node. The
// public context chooses the reporter's range-fix capability; an accidental fallthrough to
// the diagnostic-only `ReportRange` would not be caught.
//
// 1. Build a fake reporter implementing both Reporter and FixReporter.
// 2. Call `ctx.ReportRangeFix(pos, end, msg, edit)` through a public rule.Context.
// 3. Assert the FixReporter.ReportRangeFix path fired once with the edit intact.
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportRangeFix selects the available range-fix callback once, preserves literal range 3..5, msg and the complete xy edit, and avoids ordinary ReportRange fallback.
// @evidence contracts/testing.md#independent-expectations The authored diagnostic range/message and edit independently specify the callback payload; exact callback counts distinguish one capability invocation from silent fallback or duplicates.
// @evidence contracts/testing.md#distinguishing-cases Nonempty range edits and available capability contrast with the zero-edit and legacy-reporter range units. Diagnostic coordinates are checked separately from edit coordinates so forwarding only the edit cannot satisfy the test.
// @evidence contracts/testing.md#execution-ownership Direct public Context delegation executes in the Go process with an observing FixReporter. This unit owns the public capability branch and does not claim the internal contributor adapter, native producer or installed host ran.
func TestPublicRuleContextReportRangeFixForwardsToFixReporter(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  edit := rule.TextEdit{Pos: 3, End: 5, Text: "xy"}
  ctx.ReportRangeFix(3, 5, "msg", edit)
  if reporter.ranges != 0 || reporter.reports != 0 || reporter.fixCalls != 0 {
    t.Fatalf("ReportRange fallback should not fire, got %d", reporter.ranges)
  }
  if reporter.rangeFixCall != 1 {
    t.Fatalf("FixReporter.ReportRangeFix should fire once, got %d", reporter.rangeFixCall)
  }
  if !reflect.DeepEqual(reporter.lastEdits, []rule.TextEdit{edit}) {
    t.Fatalf("edits mismatch: want %+v, got %+v", []rule.TextEdit{edit}, reporter.lastEdits)
  }
  if reporter.lastPos != 3 || reporter.lastEnd != 5 || reporter.lastMessage != "msg" {
    t.Fatalf("range-fix diagnostic payload lost: %+v", reporter)
  }
  reporter = &captureReporter{}
  ctx = rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  ctx.ReportRangeFix(2, 9, "different diagnostic anchor", edit)
  if reporter.rangeFixCall != 1 || reporter.reports != 0 || reporter.ranges != 0 || reporter.fixCalls != 0 || reporter.lastPos != 2 || reporter.lastEnd != 9 || reporter.lastMessage != "different diagnostic anchor" || !reflect.DeepEqual(reporter.lastEdits, []rule.TextEdit{edit}) {
    t.Fatalf("diagnostic and edit anchors were conflated: %+v", reporter)
  }
}
