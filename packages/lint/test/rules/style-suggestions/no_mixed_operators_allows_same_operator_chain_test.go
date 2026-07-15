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
func TestNoMixedOperatorsAllowsSameOperatorChain(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "no-mixed-operators",
    "const x = a && b && c;\n",
  )
}
