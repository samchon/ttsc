package linthost

import "testing"

// TestRuleCorpusUnicornPreferMathMinMax verifies
// unicorn/prefer-math-min-max reports `a < b ? a : b`.
//
// The fixture pins the canonical `Math.min` shape — operator `<` with the
// smaller operand on the truthy branch — because the four comparison
// operators all flow through the same textual identity check. Two
// declared numeric bindings keep the AST small enough that the
// expect-annotation anchors to the conditional without any noise.
//
// 1. Enable unicorn/prefer-math-min-max via an expect annotation.
// 2. Declare `const m = a < b ? a : b;`.
// 3. Assert the conditional expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a ternary selects operands according to their relative magnitude; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-math-min-max annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Math.min expresses the same minimum operation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferMathMinMax is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferMathMinMax(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-math-min-max.ts", "declare const a: number;\ndeclare const b: number;\n// expect: unicorn/prefer-math-min-max error\nconst m = a < b ? a : b;\nvoid m;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-math-min-max", "declare const a: number; declare const b: number; const m = Math.min(a,b);\n")
}
