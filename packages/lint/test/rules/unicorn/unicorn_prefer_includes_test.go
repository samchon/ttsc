package linthost

import "testing"

// TestRuleCorpusUnicornPreferIncludes verifies unicorn/prefer-includes reports
// the canonical `arr.indexOf(x) !== -1` membership-check shape.
//
// The rule normalizes call/literal operand orientation and accepts `-1` as
// either `KindPrefixUnaryExpression(KindMinusToken, NumericLiteral("1"))` or a
// numeric literal whose text already carries the sign. This fixture pins the
// most common `!== -1` arm so regressions in operand normalization surface
// here before the wider operator matrix.
//
// 1. Enable unicorn/prefer-includes via an expect annotation.
// 2. Compare `arr.indexOf(2)` against `-1` with strict inequality.
// 3. Assert the binary expression is reported.
func TestRuleCorpusUnicornPreferIncludes(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-includes.ts", "const arr = [1, 2, 3];\n// expect: unicorn/prefer-includes error\nconst found = arr.indexOf(2) !== -1;\n")
}
