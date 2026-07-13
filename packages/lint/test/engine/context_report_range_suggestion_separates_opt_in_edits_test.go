package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type reportRangeSuggestionTestRule struct{}

func (reportRangeSuggestionTestRule) Name() string              { return "test/range-suggestion" }
func (reportRangeSuggestionTestRule) Visits() []shimast.Kind    { return nil }
func (reportRangeSuggestionTestRule) Check(*Context, *shimast.Node) {}

// TestContextReportRangeSuggestionSeparatesOptInEdits verifies the explicit
// range primitive preserves the diagnostic while isolating cloned edits from
// the automatic fix channel.
func TestContextReportRangeSuggestionSeparatesOptInEdits(t *testing.T) {
  file := parseTS(t, "const value = 1;\n")
  findings := make([]*Finding, 0, 2)
  ctx := &Context{
    File:     file,
    Severity: SeverityError,
    rule:     reportRangeSuggestionTestRule{},
    collect: func(finding *Finding) {
      findings = append(findings, finding)
    },
  }
  edits := []TextEdit{{Pos: 6, End: 11, Text: "other"}}
  ctx.ReportRangeSuggestion(4, 4, "message", "title", edits...)
  edits[0].Text = "mutated"
  ctx.ReportRangeSuggestion(0, 1, "diagnostic only", "title")

  if len(findings) != 2 {
    t.Fatalf("findings = %d, want 2", len(findings))
  }
  finding := findings[0]
  if finding.Pos != 4 || finding.End != 5 || len(finding.Fix) != 0 {
    t.Fatalf("unexpected range/fix = [%d,%d) %+v", finding.Pos, finding.End, finding.Fix)
  }
  if len(finding.Suggestions) != 1 || finding.Suggestions[0].Title != "title" ||
    len(finding.Suggestions[0].Edits) != 1 || finding.Suggestions[0].Edits[0].Text != "other" {
    t.Fatalf("suggestions = %+v", finding.Suggestions)
  }
  if len(findings[1].Suggestions) != 0 {
    t.Fatalf("empty edit list advertised a suggestion: %+v", findings[1].Suggestions)
  }

  dropped := 0
  off := &Context{File: file, Severity: SeverityOff, rule: reportRangeSuggestionTestRule{}, collect: func(*Finding) { dropped++ }}
  off.ReportRangeSuggestion(0, 1, "off", "title", TextEdit{Pos: 0, End: 1})
  noFile := &Context{Severity: SeverityError, rule: reportRangeSuggestionTestRule{}, collect: func(*Finding) { dropped++ }}
  noFile.ReportRangeSuggestion(0, 1, "no file", "title", TextEdit{Pos: 0, End: 1})
  if dropped != 0 {
    t.Fatalf("guarded contexts collected %d findings", dropped)
  }
}
