package linthost

import (
  "reflect"
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
//
// @evidence contracts/testing.md#behavioral-verification Public suggestion reporting forwards the complete ordered frames/framework alternatives with their edit coordinates and replacements plus the node/message, then independently forwards a range diagnostic without ordinary fallback.
// @evidence contracts/testing.md#independent-expectations Two literal titled candidates with authored 0..3 replacement edits define the expected menu independently of the reporter. The range control uses 2..9, distinct from edit coordinates, with an independently authored message.
// @evidence contracts/testing.md#distinguishing-cases Multiple differently sized alternatives distinguish title-only forwarding, truncation and reordering. Node/range anchors are separate positive routes; unsupported capability and zero choices have sibling negative controls.
// @evidence contracts/testing.md#execution-ownership Real public Context calls an observing SuggestionReporter in-process. The observer records arguments and counts without implementing capability selection or invoking a native producer, CLI, install or source inspection.
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
  if reporter.ranges != 0 || reporter.rangeSuggest != 0 || reporter.lastNode != node || reporter.lastMessage != "avoid the abbreviation `frm`" || !reflect.DeepEqual(reporter.lastSuggestions, suggestions) { t.Fatalf("node suggestion payload or route lost: %+v", reporter) }
  ctx.ReportRangeSuggestion(2, 9, "range suggestion", suggestions...)
  if reporter.reports != 0 || reporter.ranges != 0 || reporter.suggestCalls != 1 || reporter.rangeSuggest != 1 || reporter.lastPos != 2 || reporter.lastEnd != 9 || reporter.lastMessage != "range suggestion" || !reflect.DeepEqual(reporter.lastSuggestions, suggestions) { t.Fatalf("range suggestion payload or route lost: %+v", reporter) }
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
  lastNode *shimast.Node
  lastPos int
  lastEnd int
  lastMessage string
}

func (r *captureSuggestReporter) Report(node *shimast.Node, message string) { r.reports++; r.lastNode, r.lastMessage = node, message }
func (r *captureSuggestReporter) ReportRange(pos, end int, message string) { r.ranges++; r.lastPos, r.lastEnd, r.lastMessage = pos, end, message }

func (r *captureSuggestReporter) ReportSuggestion(node *shimast.Node, message string, suggestions ...rule.Suggestion) {
  r.suggestCalls++
  r.lastNode, r.lastMessage = node, message
  r.lastSuggestions = append([]rule.Suggestion(nil), suggestions...)
}

func (r *captureSuggestReporter) ReportRangeSuggestion(pos, end int, message string, suggestions ...rule.Suggestion) {
  r.rangeSuggest++
  r.lastPos, r.lastEnd, r.lastMessage = pos, end, message
  r.lastSuggestions = append([]rule.Suggestion(nil), suggestions...)
}
