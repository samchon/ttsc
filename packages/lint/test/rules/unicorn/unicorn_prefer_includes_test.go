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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies indexOf sentinel inequality is used only for membership; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-includes annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; includes expresses the same membership decision. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferIncludes is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferIncludes(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-includes.ts", "const arr = [1, 2, 3];\n// expect: unicorn/prefer-includes error\nconst found = arr.indexOf(2) !== -1;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-includes", "const arr = [1,2,3]; const found = arr.includes(2);\n")
}
