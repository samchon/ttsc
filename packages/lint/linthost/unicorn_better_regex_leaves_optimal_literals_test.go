package linthost

import "testing"

// TestUnicornBetterRegexLeavesOptimalLiterals verifies already-canonical regex
// literals in the nine authored inputs produce zero findings.
//
// A rule that only ever saw un-optimized input could over-report by firing on
// its own canonical output. These independently authored literals cover
// spellings intended to remain unchanged in this Go rule (shorthands
// already applied, classes already sorted, flags already ordered, quantifiers
// already compact). Zero findings does not certify a global minimum or upstream execution.
//
//  1. Lint each authored canonical declaration.
//  2. Assert no diagnostic fires.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleSkipsSource requires zero findings for nine canonical literals.
// @evidence contracts/testing.md#independent-expectations The independently authored literal corpus fixes shorthand, flag and quantifier spellings before execution, without deriving them from the Go optimizer.
// @evidence contracts/testing.md#distinguishing-cases Canonical digit/word complements, a-z ranges, lazy quantifiers, URL separators, escaped space pairs and bounded quantifiers are clean; TestUnicornBetterRegex owns changed input pairs.
// @evidence contracts/testing.md#execution-ownership The nine source inputs run in this named Go unit entry, with the rejected source in each failure; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexLeavesOptimalLiterals(t *testing.T) {
  sources := []string{
    "const foo = /\\d/;\n",
    "const foo = /\\W/i;\n",
    "const foo = /\\w/gi;\n",
    "const foo = /[a-z]/gi;\n",
    "const foo = /\\d*?/gi;\n",
    "const foo = /http:\\/\\/[^/]+\\/pull\\/commits/gi;\n",
    "const foo = /[ ;-]/g;\n",
    "const foo = /\\s?\\s?/;\n",
    "const foo = /\\s{0,2}/;\n",
  }
  for _, source := range sources {
    assertRuleSkipsSource(t, unicornBetterRegexRuleName, source)
  }
}
