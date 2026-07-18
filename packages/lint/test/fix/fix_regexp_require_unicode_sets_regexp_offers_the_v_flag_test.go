package linthost

import "testing"

// TestFixRegexpRequireUnicodeSetsRegexpOffersTheVFlag verifies
// `regexp/require-unicode-sets-regexp` offers the single `v` rewrite, replacing
// `u` where the literal already carries it.
//
// `u` and `v` are mutually exclusive, so on a `u` literal the correction is a
// substitution and not an insertion; appending would produce `uv`, which is not
// a legal flag run. It stays a suggestion rather than a fix for the same reason
// as its sibling rule: `v` is a stricter matching mode, not a respelling.
//
//  1. Assert `/a/giu` offers a replacement suggestion producing `giv`.
//  2. Assert `/a/g`, which carries no Unicode flag, offers an insertion
//     producing `gv`, and that neither literal is edited automatically.
//  3. Assert a literal already carrying `v` reports nothing.
func TestFixRegexpRequireUnicodeSetsRegexpOffersTheVFlag(t *testing.T) {
  cases := []struct {
    source string
    title  string
    result string
  }{
    {
      "const value = /a/giu;\nJSON.stringify(value);\n",
      "Replace the `u` flag with `v`.",
      "const value = /a/giv;\nJSON.stringify(value);\n",
    },
    {
      "const value = /a/g;\nJSON.stringify(value);\n",
      "Add the `v` flag.",
      "const value = /a/gv;\nJSON.stringify(value);\n",
    },
  }
  for _, tc := range cases {
    _, _, findings := runRuleFindingsSnapshot(
      t,
      "regexp/require-unicode-sets-regexp",
      tc.source,
      nil,
    )
    if len(findings) != 1 {
      t.Fatalf("%q: findings = %d, want 1", tc.source, len(findings))
    }
    finding := findings[0]
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 1 {
      t.Fatalf("%q: fixes=%d suggestions=%+v", tc.source, len(finding.Fix), finding.Suggestions)
    }
    if finding.Suggestions[0].Title != tc.title {
      t.Fatalf("%q: title = %q, want %q", tc.source, finding.Suggestions[0].Title, tc.title)
    }
    rewritten, applied := applyFindingFixesToText(
      tc.source,
      []*Finding{{Fix: finding.Suggestions[0].Edits}},
    )
    if applied != 1 || rewritten != tc.result {
      t.Fatalf("%q: applied=%d\nwant %q\ngot  %q", tc.source, applied, tc.result, rewritten)
    }
    automatic, applied := applyFindingFixesToText(tc.source, findings)
    if applied != 0 || automatic != tc.source {
      t.Fatalf("%q: automatic edits applied=%d got %q", tc.source, applied, automatic)
    }
  }

  assertRuleSkipsSource(
    t,
    "regexp/require-unicode-sets-regexp",
    "const value = /a/v;\nJSON.stringify(value);\n",
  )
}
