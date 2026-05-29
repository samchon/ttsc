package linthost

import "testing"

// TestRuleCorpusUnicornPreferArrayFind verifies unicorn/prefer-array-find reports
// the `xs.filter(...)[0]` shape.
//
// The rule walks the element-access expression and requires both the `filter`
// callee identifier and the numeric `0` index argument. This fixture pins the
// minimal positive shape: a literal array receiver, an arrow predicate, and the
// canonical `[0]` projection.
//
// 1. Enable unicorn/prefer-array-find via an expect annotation.
// 2. Project `xs.filter((x) => x > 1)[0]` to the element-access expression.
// 3. Assert the element access is reported.
func TestRuleCorpusUnicornPreferArrayFind(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-array-find.ts", "const xs = [1, 2, 3];\n// expect: unicorn/prefer-array-find error\nconst first = xs.filter((x) => x > 1)[0];\n")
}
