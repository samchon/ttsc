package linthost

import "testing"

// TestUnicornBetterRegexSkipsUnicodeFlagLiterals verifies the rule never
// touches a literal carrying the `u` or `v` flag, even when its body is
// otherwise optimizable.
//
// regexp-tree mishandles Unicode / Unicode-sets mode
// (DmitrySoshnikov/regexp-tree#162), so upstream returns early on those flags
// rather than risk an unsound rewrite. The port must skip before parsing:
// `[0-9]` collapses to `\d` without a flag, so the `/u` and `/v` twins prove
// the guard fires ahead of the optimizer, and the Unicode-property patterns
// prove those exotic bodies do not crash the skip path.
//
//  1. Lint each `u` / `v` literal, including bodies that would optimize.
//  2. Assert no diagnostic fires.
func TestUnicornBetterRegexSkipsUnicodeFlagLiterals(t *testing.T) {
  sources := []string{
    "const foo = /[0-9]/u;\n",
    "const foo = /[0-9]/v;\n",
    "const foo = /[0-9]/gu;\n",
    "const foo = /(\\s|\\.|@|_|-)/u;\n",
    "const foo = /[\\s.@_-]/u;\n",
  }
  for _, source := range sources {
    assertRuleSkipsSource(t, unicornBetterRegexRuleName, source)
  }
}
