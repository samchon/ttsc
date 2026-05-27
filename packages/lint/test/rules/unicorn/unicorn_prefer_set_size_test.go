package linthost

import "testing"

// TestRuleCorpusUnicornPreferSetSize verifies unicorn/prefer-set-size
// reports `[...set].length`.
//
// The rule keys purely on the syntactic shape (`[...x].length`), not on
// the receiver's type, so a `declare const s: Set<number>` followed by
// the spread-length expression is enough to exercise the only branch
// the rule has.
//
// 1. Enable unicorn/prefer-set-size via an expect annotation.
// 2. Read `[...s].length` on a declared Set binding.
// 3. Assert the property-access expression is reported.
func TestRuleCorpusUnicornPreferSetSize(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-set-size.ts", "declare const s: Set<number>;\n// expect: unicorn/prefer-set-size error\nconst n = [...s].length;\n")
}
