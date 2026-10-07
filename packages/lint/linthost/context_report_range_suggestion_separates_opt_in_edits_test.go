package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type reportRangeSuggestionTestRule struct{}

func (reportRangeSuggestionTestRule) Name() string                  { return "test/range-suggestion" }
func (reportRangeSuggestionTestRule) Visits() []shimast.Kind        { return nil }
func (reportRangeSuggestionTestRule) Check(*Context, *shimast.Node) {}

// TestContextReportRangeSuggestionSeparatesOptInEdits verifies the explicit
// range primitive preserves the diagnostic while isolating cloned edits from
// the automatic fix channel.
//
//  1. Report an explicit empty range with a titled action, then mutate its input.
//  2. Require normalized diagnostic bounds and the original separate action edits.
//  3. Check that absent edits keep only a diagnostic while off severity or no
//     source file prevents collection.
//
// @evidence contracts/testing.md#behavioral-verification Context.ReportRangeSuggestion retains the literal rule, severity, file, message and normalized diagnostic range while isolating the titled cloned edit from automatic fixes; empty edits retain only a diagnostic and guarded contexts emit nothing.
// @evidence contracts/testing.md#independent-expectations Authored diagnostic range [4,4) normalizes to [4,5), and the independent edit range [6,11) plus original other text must survive caller mutation. Literal messages and rule identity pin the complete diagnostic contract.
// @evidence contracts/testing.md#distinguishing-cases One edit, subsequent caller mutation, no edits, off severity and absent file distinguish cloning, optional action omission and reporting guards without conflating suggestions with automatic fixes.
// @evidence contracts/testing.md#execution-ownership A real parsed in-memory source and authored Context call ReportRangeSuggestion directly in the shared Go process; the collector observes actual Finding objects without LSP transport, rewriting source or launching a contributor.
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
  if finding.File != file || finding.Rule != "test/range-suggestion" || finding.Severity != SeverityError || finding.Message != "message" {
    t.Fatalf("diagnostic identity changed: %+v", finding)
  }
  if finding.Pos != 4 || finding.End != 5 || len(finding.Fix) != 0 {
    t.Fatalf("unexpected range/fix = [%d,%d) %+v", finding.Pos, finding.End, finding.Fix)
  }
  if len(finding.Suggestions) != 1 || finding.Suggestions[0].Title != "title" ||
    len(finding.Suggestions[0].Edits) != 1 || finding.Suggestions[0].Edits[0].Text != "other" {
    t.Fatalf("suggestions = %+v", finding.Suggestions)
  }
  if finding.Suggestions[0].Edits[0].Pos != 6 || finding.Suggestions[0].Edits[0].End != 11 {
    t.Fatalf("suggestion edit range changed: %+v", finding.Suggestions[0].Edits[0])
  }
  if findings[1].File != file || findings[1].Rule != "test/range-suggestion" || findings[1].Severity != SeverityError || findings[1].Message != "diagnostic only" || findings[1].Pos != 0 || findings[1].End != 1 || len(findings[1].Fix) != 0 {
    t.Fatalf("diagnostic-only report changed: %+v", findings[1])
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
