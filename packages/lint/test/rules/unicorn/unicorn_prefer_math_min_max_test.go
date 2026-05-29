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
func TestRuleCorpusUnicornPreferMathMinMax(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-math-min-max.ts", "declare const a: number;\ndeclare const b: number;\n// expect: unicorn/prefer-math-min-max error\nconst m = a < b ? a : b;\nvoid m;\n")
}
