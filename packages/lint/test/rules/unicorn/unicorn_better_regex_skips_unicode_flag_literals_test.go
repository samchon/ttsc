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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSource verifies Unicode-mode literals never enter the unsupported optimizer path.
// @evidence contracts/testing.md#independent-expectations The authored u/v/gu fixtures follow upstream Unicode-mode exclusions and require literal zero findings.
// @evidence contracts/testing.md#distinguishing-cases The optimizable digit class is clean with u/v/gu flags, and more exotic Unicode bodies stay clean; the flagless digit class positive is TestRuleCorpusUnicornBetterRegex.
// @evidence contracts/testing.md#execution-ownership All five excluded sources execute in this named Go unit entry; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
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
