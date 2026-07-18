package linthost

import "testing"

// TestFixRegexpWithholdsARewriteTheRegexParserRejects verifies the shared
// regexp repair gate drops a candidate edit whose result is not a valid regular
// expression, keeping the diagnostic.
//
// Every regexp repair is a splice into live regex syntax, where a locally
// correct edit can still produce a pattern the engine rejects. `/{1,}/` has no
// atom in front of the brace run, so Annex B reads it as four literal
// characters rather than a quantifier; both quantifier rules still report it,
// and rewriting it would emit `/+/` or `//` — "nothing to repeat" and a line
// comment. `/\-/` is the flag-side twin: `\-` is a legal identity escape only
// while the literal has no Unicode flag, so both `u` and `v` candidates fall
// away and the finding is left with no suggestion at all.
//
//  1. Assert both brace rules report `/{1,}/` and `/{1}/` yet apply no edit.
//  2. Assert `regexp/require-unicode-regexp` reports `/\-/` with zero
//     suggestions, rather than offering a flag that would not compile.
//  3. Assert the same rules do rewrite the well-formed twin, so the gate is
//     rejecting the invalid result and not disabling the fixers.
func TestFixRegexpWithholdsARewriteTheRegexParserRejects(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /{1,}/;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /{1}/;\nJSON.stringify(value);\n",
  )

  source := "const value = /\\-/;\nJSON.stringify(value);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "regexp/require-unicode-regexp", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1", len(findings))
  }
  if len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("fixes=%d suggestions=%+v", len(findings[0].Fix), findings[0].Suggestions)
  }

  assertFixSnapshot(
    t,
    "regexp/prefer-plus-quantifier",
    "const value = /a{1,}/;\nJSON.stringify(value);\n",
    "const value = /a+/;\nJSON.stringify(value);\n",
  )
  assertFixSnapshot(
    t,
    "regexp/no-useless-quantifier",
    "const value = /a{1}/;\nJSON.stringify(value);\n",
    "const value = /a/;\nJSON.stringify(value);\n",
  )
}
