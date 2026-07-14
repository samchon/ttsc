package linthost

import (
  "encoding/json"
  "os"
  "testing"
)

// TestUnicornStringContentFixFalseReportsSuggestionOnly verifies
// `fix: false` downgrades the rewrite to an opt-in editor suggestion.
//
// Upstream attaches the same edit as a suggestion instead of an autofix, so
// `ttsc fix` must leave the source untouched while the LSP still offers the
// replacement under the interpolated `Replace ... with ...` title. Losing
// either half silently changes what `fix` rewrites.
//
//  1. Configure `{unicorn: {suggest: "🦄", fix: false}}` and lint a literal.
//  2. Assert the finding carries no autofix but exactly one suggestion with
//     the upstream title and a whole-literal edit producing `"🦄"`.
//  3. Run the fix applier and assert the file is byte-identical afterwards.
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
