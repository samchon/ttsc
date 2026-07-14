package linthost

import "testing"

// TestUnicornBetterRegexLeavesOptimalLiterals verifies already-canonical regex
// literals produce zero findings — the negative twin of every rewrite.
//
// A rule that only ever saw un-optimized input could over-report by firing on
// its own canonical output. Each literal here is an upstream `better-regex`
// valid case that regexp-tree leaves byte-for-byte unchanged (shorthands
// already applied, classes already sorted, flags already ordered, quantifiers
// already minimal), so the optimizer's fixed point must not be flagged.
//
//  1. Lint each already-optimal declaration.
//  2. Assert no diagnostic fires.
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
