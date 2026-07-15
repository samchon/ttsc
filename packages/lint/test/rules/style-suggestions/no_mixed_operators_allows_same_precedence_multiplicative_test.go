package linthost

import "testing"

// TestNoMixedOperatorsAllowsSamePrecedenceMultiplicative verifies `a * b / c`
// is NOT flagged by default.
//
// `*` and `/` share the ARITHMETIC group AND the multiplicative precedence, so
// ESLint's default allowSamePrecedence leaves the mix alone. This guards a very
// common expression against a false positive and pins the same-precedence skip.
//
// 1. Write `const x = a * b / c;`.
// 2. Enable no-mixed-operators with default options (allowSamePrecedence on).
// 3. Assert zero findings.
func TestNoMixedOperatorsAllowsSamePrecedenceMultiplicative(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a * b / c;\n",
  )
}
