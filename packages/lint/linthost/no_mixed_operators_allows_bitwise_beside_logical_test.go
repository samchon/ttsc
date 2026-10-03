package linthost

import "testing"

// TestNoMixedOperatorsAllowsBitwiseBesideLogical verifies `a | b && c` is NOT
// flagged.
//
// Upstream fires only within one group. Bitwise `|` and logical `&&` live in
// different default groups, so the mix is left alone.
//
// 1. Write `const x = a | b && c;` (parses as `(a | b) && c`).
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Permits bitwise | beside logical && under defaults.
// @evidence contracts/testing.md#independent-expectations These operators belong to different default groups; the independently authored zero expectation preserves that grouping policy.
// @evidence contracts/testing.md#distinguishing-cases Cross-group mixed precedence contrasts with logical &&/|| violations.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsBitwiseBesideLogical(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a | b && c;\n",
  )
}
