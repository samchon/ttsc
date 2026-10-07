package linthost

import (
  "testing"
)

// TestRangeSuggestionFindingUsesCanonicalBounds covers the internal
// suggestion-only reporting surface, which does not pass through the public
// contributor ReportRange method but feeds the same LSP diagnostic pipeline.
//
//  1. Collect an internal range suggestion with malformed diagnostic bounds and a valid authored choice.
//  2. Require EOF diagnostic bounds and the complete original title, message and 0..5 let edit.
//
// @evidence contracts/testing.md#behavioral-verification Real internal range-suggestion collection canonicalizes a beyond-end/reversed diagnostic to EOF and retains its complete independent Keep the edit separate choice with one 0..5 let edit and original message.
// @evidence contracts/testing.md#independent-expectations Authored source length supplies the expected diagnostic EOF; literal title, message and candidate edit define the separately required suggestion payload independently of Context normalization.
// @evidence contracts/testing.md#distinguishing-cases Invalid diagnostic span and valid suggestion edit distinguish diagnostic clamping from candidate shifting or loss; collection must produce a real finding and exactly one complete choice.
// @evidence contracts/testing.md#execution-ownership The actual internal Context.ReportRangeSuggestion executes directly with an observing collect callback in-process; no public contributor adapter, native binary, install or edit application is asserted.
func TestRangeSuggestionFindingUsesCanonicalBounds(t *testing.T) {
  file := parseTSFile(t, "/virtual/suggestion.ts", "const value = 1;\n")
  var finding *Finding
  ctx := &Context{
    File:     file,
    Severity: SeverityError,
    rule:     boundedDiagnosticRangeHostRule{},
    collect:  func(got *Finding) { finding = got },
  }
  ctx.ReportRangeSuggestion(
    len(file.Text())+20,
    -5,
    "bounded suggestion finding",
    "Keep the edit separate",
    TextEdit{Pos: 0, End: 5, Text: "let"},
  )
  if finding == nil {
    t.Fatal("range suggestion was not reported")
  }
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{len(file.Text()), len(file.Text())}; got != want {
    t.Fatalf("suggestion finding range = %v, want %v", got, want)
  }
  if got, want := len(finding.Suggestions), 1; got != want {
    t.Fatalf("suggestions = %d, want %d: %+v", got, want, finding.Suggestions)
  }
  choice := finding.Suggestions[0]
  if finding.Message != "bounded suggestion finding" || choice.Title != "Keep the edit separate" || len(choice.Edits) != 1 || choice.Edits[0] != (TextEdit{Pos: 0, End: 5, Text: "let"}) {
    t.Fatalf("bounded suggestion lost its independent edit or title: %+v", finding)
  }
}
