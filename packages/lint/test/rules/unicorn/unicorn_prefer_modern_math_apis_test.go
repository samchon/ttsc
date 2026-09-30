package linthost

import "testing"

// TestRuleCorpusUnicornPreferModernMathApis verifies
// unicorn/prefer-modern-math-apis reports `Math.log(x) * Math.LOG10E`.
//
// The fixture pins the canonical `Math.log10` rewrite — operator `*`
// with `Math.log(x)` on the left and `Math.LOG10E` on the right —
// because the `LOG2E` constant flows through the same `Math.<NAME>`
// property-access check. One declared numeric binding keeps the AST
// small enough that the expect-annotation anchors to the binary
// expression without trailing noise.
//
// 1. Enable unicorn/prefer-modern-math-apis via an expect annotation.
// 2. Declare `const l = Math.log(x) * Math.LOG10E;`.
// 3. Assert the binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies Math.log multiplied by LOG10E manually converts the logarithm base; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-modern-math-apis annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Math.log10 directly computes the base-ten logarithm. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferModernMathApis is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferModernMathApis(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-modern-math-apis.ts", "declare const x: number;\n// expect: unicorn/prefer-modern-math-apis error\nconst l = Math.log(x) * Math.LOG10E;\nvoid l;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-modern-math-apis", "declare const x: number; const l = Math.log10(x);\n")
}
