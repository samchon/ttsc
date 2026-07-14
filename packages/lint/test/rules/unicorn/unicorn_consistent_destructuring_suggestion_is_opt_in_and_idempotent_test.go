package linthost

import "testing"

// TestUnicornConsistentDestructuringSuggestionIsOptInAndIdempotent verifies
// the replacement ships as an editor suggestion, never as an autofix, and
// that accepting it converges.
//
// Upstream declares `hasSuggestions` without a fixer, so `ttsc fix` must
// leave the source untouched while the LSP quick-fix path rewrites the
// member expression once and then finds nothing further to report.
//
//  1. Report `foo.a` after `const {a} = foo` and capture the finding.
//  2. Assert the automatic-fix path applies zero edits.
//  3. Apply the suggestion edit, assert the exact rewritten source, and
//     re-run the rule on it to prove convergence.
func TestUnicornConsistentDestructuringSuggestionIsOptInAndIdempotent(t *testing.T) {
  source := "declare const foo: { a: number };\nconst {a} = foo;\nvoid foo.a;\n"
  _, _, findings := runRuleFindingsSnapshot(t, "unicorn/consistent-destructuring", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
    t.Fatalf("fixes = %d, suggestions = %d", len(finding.Fix), len(finding.Suggestions))
  }
  suggestion := finding.Suggestions[0]
  if suggestion.Title != "Replace `foo.a` with destructured property `a`." || len(suggestion.Edits) != 1 {
    t.Fatalf("suggestion = %+v", suggestion)
  }
  prefix := "declare const foo: { a: number };\nconst {a} = foo;\nvoid "
  edit := suggestion.Edits[0]
  if edit.Pos != len(prefix) || edit.End != edit.Pos+len("foo.a") || edit.Text != "a" {
    t.Fatalf("edit = %+v", edit)
  }
  automatic, applied := applyFindingFixesToText(source, findings)
  if applied != 0 || automatic != source {
    t.Fatalf("automatic edits changed source: applied=%d source=%q", applied, automatic)
  }
  rewritten, applied := applyFindingFixesToText(source, []*Finding{{Fix: suggestion.Edits}})
  expected := "declare const foo: { a: number };\nconst {a} = foo;\nvoid a;\n"
  if applied != 1 || rewritten != expected {
    t.Fatalf("suggestion result: applied=%d\nwant %q\ngot  %q", applied, expected, rewritten)
  }
  _, _, converged := runRuleFindingsSnapshot(t, "unicorn/consistent-destructuring", rewritten, nil)
  if len(converged) != 0 {
    t.Fatalf("accepted suggestion still reports: %+v", converged)
  }
}
