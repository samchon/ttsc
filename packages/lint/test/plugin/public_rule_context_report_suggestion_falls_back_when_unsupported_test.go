package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportSuggestionFallsBackWhenUnsupported is the negative
// twin: a host that does not implement SuggestionReporter still receives the
// finding, just without the choices.
//
// This is the graceful-degradation contract that lets a contributor call
// ReportSuggestion unconditionally. Without it, a rule offering choices would go
// silent on any host that predates the interface — the failure the optional
// assertion exists to prevent. It mirrors the ReportFix legacy-reporter twin.
//
//  1. Build a reporter implementing only rule.Reporter.
//  2. Call ctx.ReportSuggestion with two suggestions.
//  3. Assert the diagnostic still lands through Report exactly once.
// @evidence contracts/testing.md#behavioral-verification Public suggestion reporting on a host without suggestion capability emits one ordinary diagnostic with the original node/msg and never substitutes a fix or unrelated range report.
// @evidence contracts/testing.md#independent-expectations The authored parsed node, msg and two a/b candidate edits require diagnostic preservation with one ordinary callback; unsupported candidates are dropped rather than converted into a chosen autofix.
// @evidence contracts/testing.md#distinguishing-cases Nonempty choices and active severity isolate missing suggestion capability. The observer supports fix reporting, which must still remain unused; sibling capable and zero-choice units cover opposite branches.
// @evidence contracts/testing.md#execution-ownership Actual public Context calls a Reporter/FixReporter observer directly in the Go process. The fixture lacks SuggestionReporter specifically and does not claim native registration, producer execution or installed-host behavior.
func TestPublicRuleContextReportSuggestionFallsBackWhenUnsupported(t *testing.T) {
  reporter := &captureReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  ctx.ReportSuggestion(node, "msg",
    rule.Suggestion{Title: "a", Edits: []rule.TextEdit{{Pos: 0, End: 1, Text: "x"}}},
    rule.Suggestion{Title: "b", Edits: []rule.TextEdit{{Pos: 0, End: 1, Text: "y"}}},
  )
  if reporter.reports != 1 {
    t.Fatalf("a reporter without SuggestionReporter must still receive the diagnostic once, got %d", reporter.reports)
  }
  if reporter.fixCalls != 0 {
    t.Fatalf("the fix path must not fire for a suggestion call, got %d", reporter.fixCalls)
  }
  if reporter.ranges != 0 || reporter.rangeFixCall != 0 || reporter.lastNode != node || reporter.lastMessage != "msg" { t.Fatalf("unsupported suggestion diagnostic payload or route lost: %+v", reporter) }
}

// TestPublicRuleContextReportSuggestionWithNoChoicesReports pins that an empty
// suggestion set degrades to a plain diagnostic rather than an empty choice
// menu — the same shape ReportFix takes when given no edits.
// @evidence contracts/testing.md#behavioral-verification Public suggestion reporting with no choices preserves the ordinary node/msg diagnostic exactly once and invokes neither node nor range suggestion capability.
// @evidence contracts/testing.md#independent-expectations An empty menu cannot offer a fix choice but does not remove the finding. Literal msg, parsed node identity and one-node/zero-other callback counts independently specify that downgrade.
// @evidence contracts/testing.md#distinguishing-cases An available SuggestionReporter and active severity isolate zero choices from missing capability or disabled reporting; the sibling nonempty-menu unit demonstrates this fixture's positive capability route.
// @evidence contracts/testing.md#execution-ownership Real public Context dispatches directly to an observing suggestion-capable reporter in-process without a native plugin build, installation, child host or source-layout assertion.
func TestPublicRuleContextReportSuggestionWithNoChoicesReports(t *testing.T) {
  reporter := &captureSuggestReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  ctx.ReportSuggestion(node, "msg")
  if reporter.suggestCalls != 0 {
    t.Fatalf("no suggestions must not open a choice menu, got %d suggestion calls", reporter.suggestCalls)
  }
  if reporter.reports != 1 {
    t.Fatalf("no suggestions must fall back to a plain diagnostic once, got %d", reporter.reports)
  }
  if reporter.ranges != 0 || reporter.rangeSuggest != 0 || reporter.lastNode != node || reporter.lastMessage != "msg" { t.Fatalf("empty suggestion diagnostic payload or route lost: %+v", reporter) }
}
