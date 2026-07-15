package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTextEncodingIdentifierCaseReportsSuggestionRangeAndMessage verifies
// a non-canonical encoding literal outside `fs.readFile` reports on the whole
// literal, carries the upstream `Prefer ... over ...` message, offers a
// suggestion (not an autofix), and rewrites only the text inside the quotes.
//
// The message interpolates the raw spelling and its replacement, so a swapped
// pair would tell the reader to rewrite `utf8` into `utf-8` by default. The edit
// must land on `[start+1, end-1)` — a fix that swallowed a quote would corrupt
// the literal — and it must be a suggestion, because upstream only autofixes the
// `fs.readFile` position.
//
//  1. Lint one non-canonical encoding literal in a neutral position.
//  2. Assert a single finding at the literal token with the exact message.
//  3. Assert no autofix, and one suggestion editing the quoted content.
func TestUnicornTextEncodingIdentifierCaseReportsSuggestionRangeAndMessage(t *testing.T) {
  for _, testCase := range []struct {
    literal     string
    replacement string
  }{
    {literal: "\"utf-8\"", replacement: "utf8"},
    {literal: "\"UTF-8\"", replacement: "utf8"},
    {literal: "\"UTF8\"", replacement: "utf8"},
    {literal: "\"ASCII\"", replacement: "ascii"},
    {literal: "\"Ascii\"", replacement: "ascii"},
  } {
    source := "const enc = " + testCase.literal + ";\nvoid enc;\n"
    start := strings.Index(source, testCase.literal)
    if start < 0 {
      t.Fatalf("literal %q missing from source", testCase.literal)
    }
    end := start + len(testCase.literal)
    inner := testCase.literal[1 : len(testCase.literal)-1]
    wantMessage := "Prefer `" + testCase.replacement + "` over `" + inner + "`."
    wantTitle := "Replace `" + inner + "` with `" + testCase.replacement + "`."

    _, _, findings := runRuleFindingsSnapshot(t, unicornTextEncodingIdentifierCaseRuleName, source, nil)
    if len(findings) != 1 {
      t.Fatalf("%s: want 1 finding, got %d (%+v)", testCase.literal, len(findings), findings)
    }
    finding := findings[0]
    if finding.Message != wantMessage {
      t.Fatalf("%s: message got %q, want %q", testCase.literal, finding.Message, wantMessage)
    }
    if finding.Pos != start || finding.End != end {
      t.Fatalf("%s: range want [%d,%d), got [%d,%d)", testCase.literal, start, end, finding.Pos, finding.End)
    }
    if len(finding.Fix) != 0 {
      t.Fatalf("%s: want no autofix, got %+v", testCase.literal, finding.Fix)
    }
    if len(finding.Suggestions) != 1 {
      t.Fatalf("%s: want one suggestion, got %+v", testCase.literal, finding.Suggestions)
    }
    suggestion := finding.Suggestions[0]
    if suggestion.Title != wantTitle {
      t.Fatalf("%s: suggestion title got %q, want %q", testCase.literal, suggestion.Title, wantTitle)
    }
    if len(suggestion.Edits) != 1 {
      t.Fatalf("%s: want one suggestion edit, got %+v", testCase.literal, suggestion.Edits)
    }
    edit := suggestion.Edits[0]
    if edit.Pos != start+1 || edit.End != end-1 || edit.Text != testCase.replacement {
      t.Fatalf("%s: edit want [%d,%d)=%q, got [%d,%d)=%q",
        testCase.literal, start+1, end-1, testCase.replacement, edit.Pos, edit.End, edit.Text)
    }
  }
}
