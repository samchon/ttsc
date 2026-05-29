package linthost

import "testing"

// TestRuleCorpusUnicornPreferMathTrunc verifies unicorn/prefer-math-trunc
// reports the `~~x` bitwise-truncation idiom.
//
// `~~x` parses as `~(~x)` — a PrefixUnaryExpression whose operand is
// another PrefixUnaryExpression. The fixture pins that nested-tilde
// shape because the `x | 0` shape is exercised by a separate fixture
// elsewhere in the corpus.
//
// 1. Enable unicorn/prefer-math-trunc via an expect annotation.
// 2. Declare a const initialized to `~~3.7`.
// 3. Assert the outer unary expression is reported.
func TestRuleCorpusUnicornPreferMathTrunc(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-math-trunc.ts", "// expect: unicorn/prefer-math-trunc error\nconst i = ~~3.7;\n")
}
