package linthost

import "testing"

// TestNoMixedOperatorsAllowsRelationalSamePrecedence verifies
// `a in b instanceof c` is NOT flagged by default.
//
// `in` and `instanceof` are ESLint's RELATIONAL group and share the relational
// precedence, so default allowSamePrecedence leaves them alone even though the
// operators differ. This pins the relational family plus the same-precedence
// allowance in one negative case.
//
// 1. Write `const x = a in b instanceof c;` (parses as `(a in b) instanceof c`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsRelationalSamePrecedence(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a in b instanceof c;\n",
  )
}
