package main

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
// adapter at contrib_adapter.go::ReportRangeFix forwards to the engine's
// `Context.ReportRangeFix`; without this test, an accidental fallthrough to
// the diagnostic-only `ReportRange` would not be caught.
//
// 1. Build a fake reporter implementing both Reporter and FixReporter.
// 2. Call `ctx.ReportRangeFix(pos, end, msg, edit)` through a public rule.Context.
// 3. Assert the FixReporter.ReportRangeFix path fired once with the edit intact.
func TestPublicRuleContextReportRangeFixForwardsToFixReporter(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, reporter)
  edit := rule.TextEdit{Pos: 3, End: 5, Text: "xy"}
  ctx.ReportRangeFix(3, 5, "msg", edit)
  if reporter.ranges != 0 {
    t.Fatalf("ReportRange fallback should not fire, got %d", reporter.ranges)
  }
  if reporter.rangeFixCall != 1 {
    t.Fatalf("FixReporter.ReportRangeFix should fire once, got %d", reporter.rangeFixCall)
  }
  if !reflect.DeepEqual(reporter.lastEdits, []rule.TextEdit{edit}) {
    t.Fatalf("edits mismatch: want %+v, got %+v", []rule.TextEdit{edit}, reporter.lastEdits)
  }
}
