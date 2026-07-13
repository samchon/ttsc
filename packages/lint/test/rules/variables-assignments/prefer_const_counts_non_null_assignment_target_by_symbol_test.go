package linthost

import "testing"

// TestPreferConstCountsNonNullAssignmentTargetBySymbol verifies asserted writes remain mutable.
//
// TypeScript wraps `value!` in a NonNullExpression even when it appears on an
// assignment's left side. The target walker must unwrap that node so a later
// asserted write prevents prefer-const from offering an invalid keyword fix.
//
//  1. Initialize a nullable let binding.
//  2. Reassign it through a non-null assertion target.
//  3. Assert prefer-const emits no finding for the mutable binding.
func TestPreferConstCountsNonNullAssignmentTargetBySymbol(t *testing.T) {
  assertRuleSkipsSource(t, "prefer-const", `let value: number | undefined = undefined;
value! = 2;
console.log(value);
`)
}
