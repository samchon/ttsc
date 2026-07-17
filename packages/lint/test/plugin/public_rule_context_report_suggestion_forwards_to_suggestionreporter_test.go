package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestPublicRuleContextReportSuggestionForwardsToSuggestionReporter verifies the
// contributor suggestion path.
//
// A choice of fixes is the one thing `ReportFix` cannot express, and it was
// reachable only by built-in rules until `rule.Context` gained
// `ReportSuggestion`. A contributor that knows three valid renames had to impose
// one or describe them in prose. This pins that the public call reaches a host
// implementing `SuggestionReporter` with every choice intact, so a refactor of
// the unexported assertion site cannot silently downgrade it to a plain
// diagnostic.
//
//  1. Build a reporter implementing Reporter + SuggestionReporter.
//  2. Call `ctx.ReportSuggestion` with two titled suggestions through a public
//     rule.Context.
//  3. Assert the suggestion path fired once with both choices, and the
//     diagnostic-only fallback did not.
func TestPublicRuleContextReportSuggestionForwardsToSuggestionReporter(t *testing.T) {
  reporter := &captureSuggestReporter{}
  ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, reporter)
  node := newDummyNode(t)
  suggestions := []rule.Suggestion{
    {Title: "Rename to `frames`", Edits: []rule.TextEdit{{Pos: 0, End: 3, Text: "frames"}}},
    {Title: "Rename to `framework`", Edits: []rule.TextEdit{{Pos: 0, End: 3, Text: "framework"}}},
  }
  ctx.ReportSuggestion(node, "avoid the abbreviation `frm`", suggestions...)

  if reporter.reports != 0 {
    t.Fatalf("Report fallback should not fire when SuggestionReporter is available, got %d", reporter.reports)
  }
  if reporter.suggestCalls != 1 {
    t.Fatalf("ReportSuggestion should fire exactly once, got %d", reporter.suggestCalls)
  }
  if len(reporter.lastSuggestions) != 2 {
    t.Fatalf("want 2 suggestions delivered, got %d", len(reporter.lastSuggestions))
  }
  if reporter.lastSuggestions[0].Title != "Rename to `frames`" ||
    reporter.lastSuggestions[1].Title != "Rename to `framework`" {
    t.Fatalf("suggestion titles or order not preserved: %+v", reporter.lastSuggestions)
  }
}

// captureSuggestReporter implements the legacy `rule.Reporter` plus the public
// `rule.SuggestionReporter` extension, so the positive suggestion path can be
// observed. A reporter implementing only Reporter is the fallback twin in
// public_rule_context_report_suggestion_falls_back_when_unsupported_test.go.
type captureSuggestReporter struct {
  reports         int
  ranges          int
  suggestCalls    int
  rangeSuggest    int
  lastSuggestions []rule.Suggestion
}

func (r *captureSuggestReporter) Report(_ *shimast.Node, _ string) { r.reports++ }
func (r *captureSuggestReporter) ReportRange(_, _ int, _ string)   { r.ranges++ }

func (r *captureSuggestReporter) ReportSuggestion(_ *shimast.Node, _ string, suggestions ...rule.Suggestion) {
  r.suggestCalls++
  r.lastSuggestions = append([]rule.Suggestion(nil), suggestions...)
}

func (r *captureSuggestReporter) ReportRangeSuggestion(_, _ int, _ string, suggestions ...rule.Suggestion) {
  r.rangeSuggest++
  r.lastSuggestions = append([]rule.Suggestion(nil), suggestions...)
}
