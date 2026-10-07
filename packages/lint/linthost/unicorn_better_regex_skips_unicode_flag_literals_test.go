package linthost

import "testing"

// TestUnicornBetterRegexSkipsUnicodeFlagLiterals verifies the rule never
// touches a literal carrying the `u` or `v` flag, even when its body is
// otherwise optimizable.
//
// The historical regexp-tree issue documents escaped-character parsing failures
// under `u` (DmitrySoshnikov/regexp-tree#162). This Go rule returns early on u/v
// literals before its optimizer. These zero-findings probes observe the exclusions:
// `[0-9]` collapses to `\d` without a flag, so the `/u` and `/v` twins prove
// the expected distinction, and the alternation and character-class
// bodies under the `u` flag provide two more excluded shapes. They do not observe optimizer calls.
//
//  1. Lint each `u` / `v` literal, including bodies that would optimize.
//  2. Assert no diagnostic fires.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSource requires zero findings for the five authored Unicode-mode literals; source inspection separately identifies the early flag guard.
// @evidence contracts/testing.md#independent-expectations The authored u/v/gu fixtures independently specify zero findings without reading optimizer output or certifying upstream parity.
// @evidence contracts/testing.md#distinguishing-cases The optimizable digit class is clean with u/v/gu flags, and `u`-flagged alternation and character-class bodies that the optimizer would otherwise rewrite stay clean; the flagless digit class positive is the corpus fixture unicorn-better-regex.ts.
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
