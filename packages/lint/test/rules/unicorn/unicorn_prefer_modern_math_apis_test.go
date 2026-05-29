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
func TestRuleCorpusUnicornPreferModernMathApis(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-modern-math-apis.ts", "declare const x: number;\n// expect: unicorn/prefer-modern-math-apis error\nconst l = Math.log(x) * Math.LOG10E;\nvoid l;\n")
}
