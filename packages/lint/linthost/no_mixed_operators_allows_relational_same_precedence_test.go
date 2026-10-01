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
//
// @evidence contracts/testing.md#behavioral-verification Permits chained in and instanceof under the default same-precedence allowance.
// @evidence contracts/testing.md#independent-expectations Both are relational operators at equal precedence; the literal zero oracle follows default allowSamePrecedence true.
// @evidence contracts/testing.md#distinguishing-cases Different operator spellings at equal precedence distinguish equality of precedence from equality of operator.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsRelationalSamePrecedence(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a in b instanceof c;\n",
  )
}
