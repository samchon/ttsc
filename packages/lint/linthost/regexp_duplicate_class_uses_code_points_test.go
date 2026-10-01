package linthost

import "testing"

// TestRegexpDuplicateClassUsesCodePoints verifies regex class character identity.
//
// UTF-8 encoding bytes are not regular-expression characters. Escapes also
// consume complete syntax atoms; their hexadecimal digits are not class members.
//
// 1. Parse authored regex literals through the owning Engine.
// 2. Compare exact diagnostic counts across character and escape boundaries.
//
// @evidence contracts/testing.md#behavioral-verification The Engine reports repeated class members without confusing UTF-8 prefix bytes or escape syntax with duplicate characters.
// @evidence contracts/testing.md#independent-expectations Distinct accented and astral characters are distinct Unicode code points; hexadecimal and Unicode escapes denote their decoded character rather than their spelling digits.
// @evidence contracts/testing.md#distinguishing-cases ASCII, accents, repeated accents, escaped equivalents, ranges, negation, astral u/v and legacy surrogate members have independent literal counts.
// @evidence contracts/testing.md#execution-ownership TestRegexpDuplicateClassUsesCodePoints invokes runRuleFindingsSnapshot in the enrolled rules unit population with the actual parser/Engine; no RegExp runtime replacement, installed consumer or child native producer is involved.
func TestRegexpDuplicateClassUsesCodePoints(t *testing.T) {
  cases := []struct { literal string; want int }{
    {`/[ab]/u`, 0}, {`/[aa]/u`, 1}, {`/[éê]/u`, 0}, {`/[éé]/u`, 1},
    {`/[^éê]/u`, 0}, {`/[éê]/`, 0}, {`/[éê]/v`, 0},
    {`/[\u00e9\u00ea]/u`, 0}, {`/[é\u00e9]/u`, 1},
    {`/[a\x61]/u`, 1}, {`/[\x41\x42]/u`, 0},
    {`/[😀😁]/u`, 0}, {`/[😀😀]/u`, 1}, {`/[😀😁]/v`, 0},
    {`/[😀😁]/`, 1},
    {`/[\uD83D\uDE00\uD83D\uDE01]/u`, 0},
    {`/[\uD83D\uDE00\uD83D\uDE01]/`, 1},
    {`/[a-z]/u`, 0}, {`/[\d\w]/u`, 0},
    {`/[[aa]&&[a]]/v`, 0},
  }
  for _, c := range cases {
    t.Run(c.literal, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "regexp/no-dupe-characters-character-class", "const value = " + c.literal + ";", nil)
      if len(findings) != c.want { t.Errorf("findings=%d, want %d: %+v", len(findings), c.want, findings) }
    })
  }
}
