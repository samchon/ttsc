package linthost

import "testing"

// TestRuleCorpusUnicornNumericSeparatorsStyle verifies the rule reports a
// numeric literal whose `_` grouping is non-canonical.
//
// Canonical decimal grouping is `^[0-9]{1,3}(_[0-9]{3})*$`. `1_2345`
// fails — the rightmost group is four digits and the leading group is
// one digit — so the literal pins the failing-regex branch the MVP
// implementation relies on.
//
// 1. Enable unicorn/numeric-separators-style via an expect annotation.
// 2. Declare a const initialized to `1_2345`.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornNumericSeparatorsStyle(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/numeric-separators-style.ts", "// expect: unicorn/numeric-separators-style error\nconst big = 1_2345;\n")
}
