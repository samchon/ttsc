package linthost

import "testing"

// TestAwaitThenableAwaitExpressionOffersExactSuggestion verifies an ordinary
// non-thenable await keeps its diagnostic but exposes only upstream's token
// removal suggestion.
func TestAwaitThenableAwaitExpressionOffersExactSuggestion(t *testing.T) {
  source := "async function run() {\n  await /* keep trivia */ 0;\n}\nvoid run();\n"
  _, _, findings := runRuleFindingsSnapshot(t, "typescript/await-thenable", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
    t.Fatalf("fixes = %d, suggestions = %d", len(finding.Fix), len(finding.Suggestions))
  }
  suggestion := finding.Suggestions[0]
  if suggestion.Title != "Remove unnecessary `await`." || len(suggestion.Edits) != 1 {
    t.Fatalf("suggestion = %+v", suggestion)
  }
  edit := suggestion.Edits[0]
  if edit.Pos != len("async function run() {\n  ") || edit.End != edit.Pos+len("await") || edit.Text != "" {
    t.Fatalf("edit = %+v", edit)
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
  }
  rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: suggestion.Edits}})
  expected := "async function run() {\n   /* keep trivia */ 0;\n}\nvoid run();\n"
  if applied != 1 || rewritten != expected {
    t.Fatalf("suggestion result: applied=%d\nwant %q\ngot  %q", applied, expected, rewritten)
  }
}
