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
//
// @evidence contracts/testing.md#behavioral-verification The type-aware Engine emits zero prefer-const findings when the initialized nullable binding is reassigned through a non-null asserted target.
// @evidence contracts/testing.md#independent-expectations The asserted left operand still denotes a write to the same binding; that language meaning independently establishes the clean mutable control.
// @evidence contracts/testing.md#distinguishing-cases Non-null-wrapped assignment owns this negative target normalization boundary; TestPreferConstCountsWriteFormsBySymbol includes a stable reportable sibling and unwrapped writes.
// @evidence contracts/testing.md#execution-ownership TestPreferConstCountsNonNullAssignmentTargetBySymbol owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes the owning operation with a real Program and Checker and isolated fixture files, without a consumer install, native artifact build or product host.
func TestPreferConstCountsNonNullAssignmentTargetBySymbol(t *testing.T) {
  assertRuleSkipsSource(t, "prefer-const", `let value: number | undefined = undefined;
value! = 2;
console.log(value);
`)
}
