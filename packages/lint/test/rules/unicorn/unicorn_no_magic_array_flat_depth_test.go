package linthost

import "testing"

// TestRuleCorpusUnicornNoMagicArrayFlatDepth verifies
// unicorn/no-magic-array-flat-depth reports `.flat(2)` and friends.
//
// The rule fires only for a single NumericLiteral argument whose text is
// neither "1" (default depth) nor `Infinity` (parsed as an Identifier, so the
// kind check exempts it automatically). The fixture uses `2`, the smallest
// magic depth, to pin the positive case.
//
// 1. Enable unicorn/no-magic-array-flat-depth via an expect annotation.
// 2. Call `.flat(2)` on a nested array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoMagicArrayFlatDepth(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-magic-array-flat-depth.ts", "// expect: unicorn/no-magic-array-flat-depth error\nconst flat = [1, [2, [3]]].flat(2);\nvoid flat;\n")
}
