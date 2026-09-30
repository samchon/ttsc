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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies double bitwise negation truncates with 32-bit coercion; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-math-trunc annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Math.trunc explicitly truncates the numeric value. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferMathTrunc is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferMathTrunc(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-math-trunc.ts", "// expect: unicorn/prefer-math-trunc error\nconst i = ~~3.7;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-math-trunc", "const i = Math.trunc(3.7);\n")
}
