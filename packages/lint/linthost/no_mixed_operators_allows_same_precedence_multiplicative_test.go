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
//
// @evidence contracts/testing.md#behavioral-verification Permits a*b/c under default same-precedence allowance.
// @evidence contracts/testing.md#independent-expectations Multiplication and division share precedence; literal zero result follows the supported default option.
// @evidence contracts/testing.md#distinguishing-cases Different same-precedence arithmetic operators contrast with * nested under +.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsSamePrecedenceMultiplicative(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a * b / c;\n",
  )
}
