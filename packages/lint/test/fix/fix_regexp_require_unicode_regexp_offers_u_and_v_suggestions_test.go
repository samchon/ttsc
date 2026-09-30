package linthost

import "testing"

// TestFixRegexpRequireUnicodeRegexpOffersUAndVSuggestions verifies
// `regexp/require-unicode-regexp` offers `u` and `v` as competing suggestions
// and imposes neither.
//
// Both flags satisfy the rule and both change what the pattern matches — a
// surrogate pair stops being two independent code units — so there is no single
// right answer to apply automatically. The flag is inserted at its canonical
// position rather than appended, so adding it to a literal ending in `y` does
// not leave a run that `regexp/sort-flags` immediately re-reports.
//
//  1. Report on `/a/gy`, whose canonical insertion point is in the middle.
//  2. Assert `ttsc fix` applies nothing, and each suggestion produces `guy`
//     and `gvy` respectively.
//  3. Assert a literal that already carries `u`, and one that carries `v`,
//     report nothing.
//
// @evidence contracts/testing.md#behavioral-verification The Unicode regex rule offers u and v suggestions in canonical flag position while withholding automatic edits.
// @evidence contracts/testing.md#independent-expectations Literal titles and guy/gvy source results preserve g/y and the entire statement; neither expected result comes from the emitted edit.
// @evidence contracts/testing.md#distinguishing-cases No-Unicode flags require two choices; already-u and already-v regexes stay silent, and the automatic pass preserves original source.
// @evidence contracts/testing.md#execution-ownership TestFixRegexpRequireUnicodeRegexpOffersUAndVSuggestions owns both opt-in applyFindingFixesToText calls and its runRuleFindingsSnapshot/skip controls.
func TestFixRegexpRequireUnicodeRegexpOffersUAndVSuggestions(t *testing.T) {
  source := "const value = /a/gy;\nJSON.stringify(value);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "regexp/require-unicode-regexp", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  finding := findings[0]
  if len(finding.Fix) != 0 {
    t.Fatalf("automatic fixes = %d, want 0", len(finding.Fix))
  }
  if len(finding.Suggestions) != 2 {
    t.Fatalf("suggestions = %+v", finding.Suggestions)
  }
  expected := []struct {
    title  string
    result string
  }{
    {"Add the `u` flag.", "const value = /a/guy;\nJSON.stringify(value);\n"},
    {"Add the `v` flag.", "const value = /a/gvy;\nJSON.stringify(value);\n"},
  }
  for index, want := range expected {
    suggestion := finding.Suggestions[index]
    if suggestion.Title != want.title {
      t.Fatalf("suggestion %d title = %q, want %q", index, suggestion.Title, want.title)
    }
    rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: suggestion.Edits}})
    if applied != 1 || rewritten != want.result {
      t.Fatalf("suggestion %d: applied=%d\nwant %q\ngot  %q", index, applied, want.result, rewritten)
    }
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
  }

  assertRuleSkipsSource(
    t,
    "regexp/require-unicode-regexp",
    "const value = /a/u;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/require-unicode-regexp",
    "const value = /a/v;\nJSON.stringify(value);\n",
  )
}
