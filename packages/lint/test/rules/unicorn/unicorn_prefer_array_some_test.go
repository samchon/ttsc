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
func TestRuleCorpusUnicornPreferArraySome(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-some.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-some error\nconst any = xs.filter((x) => x > 1).length > 0;\n")
}
