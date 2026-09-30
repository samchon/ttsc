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
