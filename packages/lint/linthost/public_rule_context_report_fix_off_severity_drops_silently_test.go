package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Public node/range fix reports at SeverityOff invoke none of the four ordinary/fix callbacks; nil contexts and contexts without reporters also accept both calls without panic.
// @evidence contracts/testing.md#independent-expectations Disabled severity or an absent reporting channel is inert regardless of authored edits. All four literal zero callback counts establish silence rather than merely the absence of a particular fix callback.
// @evidence contracts/testing.md#distinguishing-cases Valid parsed node, nonempty edits and a capable reporter isolate the off-severity gate; nil-context and missing-reporter calls cover independent defensive boundaries. Neighboring active forwarding units provide positive reporter controls.
// @evidence contracts/testing.md#execution-ownership Real public Context methods execute directly in the Go process against an observing reporter and literal ranges. No rule dispatch, native plugin artifact, installation or external host is asserted.
func TestPublicRuleContextReportFixOffSeverityDropsSilently(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityOff, nil, reporter)
  ctx.ReportFix(newDummyNode(t), "msg", rule.TextEdit{Pos: 0, End: 1, Text: ""})
  ctx.ReportRangeFix(1, 4, "msg", rule.TextEdit{Pos: 1, End: 4, Text: ""})
  if reporter.reports != 0 || reporter.ranges != 0 ||
    reporter.fixCalls != 0 || reporter.rangeFixCall != 0 {
    t.Fatalf("SeverityOff should drop every report path, got reports=%d ranges=%d fix=%d rangefix=%d",
      reporter.reports, reporter.ranges, reporter.fixCalls, reporter.rangeFixCall)
  }
  var absent *rule.Context
  for _, inactive := range []*rule.Context{absent, rule.NewContext(nil, nil, rule.SeverityError, nil, nil)} {
    inactive.ReportFix(newDummyNode(t), "msg", rule.TextEdit{Pos: 0, End: 1, Text: ""})
    inactive.ReportRangeFix(1, 4, "msg", rule.TextEdit{Pos: 1, End: 4, Text: ""})
  }
}
