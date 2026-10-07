package linthost

import (
  "encoding/json"
  "os"
  "strings"
  "testing"
)

// TestUnicornStringContentFixFalseReportsSuggestionOnly verifies
// `fix: false` downgrades the rewrite to an opt-in editor suggestion.
//
// Upstream attaches the same edit as a suggestion instead of an autofix, so
// this unit checks the finding's interpolated `Replace ... with ...` title
// and verifies the fix applier leaves the source untouched. CLI and LSP
// dispatch are not exercised here.
//
//  1. Configure `{unicorn: {suggest: "🦄", fix: false}}` and lint a literal.
//  2. Assert the finding carries no autofix but exactly one suggestion with
//     the upstream title and a whole-literal edit producing `"🦄"`.
//  3. Run the fix applier and assert the file is byte-identical afterwards.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot checks exact message, absent autofix and one suggestion title, replacement text and exact quoted-literal finding/edit boundaries; applyFindingFixes must report zero changes and preserve the original file bytes.
// @evidence contracts/testing.md#independent-expectations The public fix:false contract and official Unicorn suggestion message define the literal title and replacement; filesystem comparison uses the independently authored original source.
// @evidence contracts/testing.md#distinguishing-cases A matching unicorn literal still reports with an editor suggestion but cannot auto-apply. ReportsAndFixesPlainStringLiteral owns the default autofix counterpart.
// @evidence contracts/testing.md#execution-ownership TestUnicornStringContentFixFalseReportsSuggestionOnly is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while engine, parser and fix operations share one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestUnicornStringContentFixFalseReportsSuggestionOnly(t *testing.T) {
  source := `const foo = "unicorn";` + "\n"
  options := `{"patterns":{"unicorn":{"suggest":"🦄","fix":false}}}`

  root, filePath, findings := runRuleFindingsSnapshot(t, "unicorn/string-content", source, json.RawMessage(options))
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != "Prefer `🦄` over `unicorn`." {
    t.Fatalf("message: got %q", finding.Message)
  }
  if len(finding.Fix) != 0 {
    t.Fatalf("fix-false finding must not carry an autofix, got %+v", finding.Fix)
  }
  if len(finding.Suggestions) != 1 {
    t.Fatalf("want one suggestion, got %+v", finding.Suggestions)
  }
  suggestion := finding.Suggestions[0]
  if suggestion.Title != "Replace `unicorn` with `🦄`." {
    t.Fatalf("suggestion title: got %q", suggestion.Title)
  }
  if len(suggestion.Edits) != 1 || suggestion.Edits[0].Text != `"🦄"` {
    t.Fatalf("suggestion edit: want one whole-literal edit to \"🦄\", got %+v", suggestion.Edits)
  }
  wantStart := strings.Index(source, `"unicorn"`)
  wantEnd := wantStart + len(`"unicorn"`)
  if finding.Pos != wantStart || finding.End != wantEnd ||
    suggestion.Edits[0].Pos != wantStart || suggestion.Edits[0].End != wantEnd {
    t.Fatalf("suggestion must replace only the quoted literal [%d,%d), got finding %+v and edit %+v", wantStart, wantEnd, finding, suggestion.Edits[0])
  }

  fixed, err := applyFindingFixes(root, findings)
  if err != nil {
    t.Fatalf("applyFindingFixes: %v", err)
  }
  if fixed != 0 {
    t.Fatalf("suggestion-only finding must not be auto-applied, got %d fixes", fixed)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != source {
    t.Fatalf("source must stay untouched:\nwant %q\ngot  %q", source, string(got))
  }
}
