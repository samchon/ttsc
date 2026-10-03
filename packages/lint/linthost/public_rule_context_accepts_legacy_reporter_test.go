package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextAcceptsLegacyReporter verifies contributor reporter compatibility.
//
// ReportFix is a new convenience on the public contributor Context, but the
// existing Reporter interface must remain source-compatible for contributor
// tests or helpers that implement only Report and ReportRange.
//
// 1. Construct a public rule.Context with a legacy two-method Reporter.
// 2. Call ReportRangeFix with one text edit.
// 3. Assert the diagnostic falls back to ReportRange instead of requiring a new method.
//
// @evidence contracts/testing.md#behavioral-verification Public Context.ReportRangeFix accepts a reporter with only ordinary Report/ReportRange, forwards exactly one range diagnostic with literal 1..2 and message, and does not substitute a node report.
// @evidence contracts/testing.md#independent-expectations A legacy host retains the original diagnostic while dropping unsupported candidate edits. The authored range/message and one-range/zero-node callback counts independently specify that compatibility result.
// @evidence contracts/testing.md#distinguishing-cases Nonempty edits and active severity isolate unavailable fix capability from zero edits or off severity. The sibling node-fix legacy unit and capable range-fix unit cover the other anchor and opposite capability branch.
// @evidence contracts/testing.md#execution-ownership A real public Context invokes an observing legacy Reporter directly in-process. Runtime fallback is observed without repository interface-text checks, native artifacts, installed consumer hosts or subprocesses.
func TestPublicRuleContextAcceptsLegacyReporter(t *testing.T) {
  reporter := &legacyReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  ctx.ReportRangeFix(1, 2, "message", rule.TextEdit{Pos: 1, End: 2, Text: "x"})
  if reporter.ranges != 1 {
    t.Fatalf("legacy reporter should receive ReportRange fallback, got %d", reporter.ranges)
  }
  if reporter.reports != 0 || reporter.lastPos != 1 || reporter.lastEnd != 2 || reporter.lastMessage != "message" { t.Fatalf("legacy range payload lost: %+v", reporter) }
}

type legacyReporter struct {
  ranges int
  reports int
  lastPos int
  lastEnd int
  lastMessage string
}

func (r *legacyReporter) Report(_ *shimast.Node, _ string) { r.reports++ }

func (r *legacyReporter) ReportRange(pos, end int, message string) {
  r.ranges++
  r.lastPos, r.lastEnd, r.lastMessage = pos, end, message
}
