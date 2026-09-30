package linthost

import "testing"

// TestNoMixedOperatorsAllowsSameOperatorChain verifies `a && b && c` is NOT
// flagged.
//
// A repeated operator carries no grouping ambiguity, so upstream's
// isMixedWithParent requires the child and parent operators to DIFFER. This
// pins the same-operator short-circuit so associative chains stay silent.
//
// 1. Write `const x = a && b && c;`.
// 2. Enable no-mixed-operators with default options.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Permits a&&b&&c.
// @evidence contracts/testing.md#independent-expectations Repeated identical operator has no mixed-operator ambiguity; the independently authored zero result follows that contract.
// @evidence contracts/testing.md#distinguishing-cases Same-operator chain contrasts with &&/|| mixtures.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes this entry's exact authored source through the enabled engine rule; this Test owns its zero-finding comparison. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoMixedOperatorsAllowsSameOperatorChain(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a && b && c;\n",
  )
}
