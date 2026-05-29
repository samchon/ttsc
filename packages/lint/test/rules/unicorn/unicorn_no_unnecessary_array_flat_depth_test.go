package linthost

import "testing"

// TestRuleCorpusUnicornNoUnnecessaryArrayFlatDepth verifies
// unicorn/no-unnecessary-array-flat-depth reports `.flat(1)`.
//
// `Array#flat()` defaults to depth 1, so passing the literal `1` is a
// redundant spelling. The rule's NumericLiteral-text check on "1" is the
// only branch, so this minimal positive case pins both the kind check and
// the text comparison.
//
// 1. Enable unicorn/no-unnecessary-array-flat-depth via an expect annotation.
// 2. Call `.flat(1)` on an array literal.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornNoUnnecessaryArrayFlatDepth(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unnecessary-array-flat-depth.ts", "// expect: unicorn/no-unnecessary-array-flat-depth error\nconst flat = [1, [2]].flat(1);\nvoid flat;\n")
}
