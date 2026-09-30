package linthost

import "testing"

// TestRuleCorpusUnicornPreferArraySome verifies unicorn/prefer-array-some reports
// the `xs.filter(...).length > 0` shape.
//
// The rule walks the binary expression and requires `filter(...).length` on the
// left, `0` on the right, and one of the inequality-against-zero comparison
// operators. This fixture pins the canonical `> 0` arm so regressions in the
// operator gate or the `.filter().length` chain surface here.
//
// 1. Enable unicorn/prefer-array-some via an expect annotation.
// 2. Compare `xs.filter((x) => x > 1).length` against zero with `>`.
// 3. Assert the binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies filter result length is tested only for existence; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-array-some annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; some asks the same existence question without creating an array. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferArraySome is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferArraySome(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-some.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-some error\nconst any = xs.filter((x) => x > 1).length > 0;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-array-some", "const xs = [1,2,3]; const any = xs.some(x => x > 1);\n")
}
