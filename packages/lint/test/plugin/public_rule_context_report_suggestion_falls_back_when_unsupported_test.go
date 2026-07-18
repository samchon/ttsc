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
}

// TestPublicRuleContextReportSuggestionWithNoChoicesReports pins that an empty
// suggestion set degrades to a plain diagnostic rather than an empty choice
// menu — the same shape ReportFix takes when given no edits.
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
}
