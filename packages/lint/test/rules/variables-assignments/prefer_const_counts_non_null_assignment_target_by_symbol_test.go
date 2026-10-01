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
// @evidence contracts/testing.md#execution-ownership TestPreferConstCountsNonNullAssignmentTargetBySymbol assertRuleSkipsSource runs the prefer-const engine through runRuleFindingsSnapshotFile, which loads a temp tsconfig project with a real Program and Checker because the rule needs bindings, and requires zero findings for the non-null-asserted write. No consumer install, native build or product host runs.
func TestPreferConstCountsNonNullAssignmentTargetBySymbol(t *testing.T) {
  assertRuleSkipsSource(t, "prefer-const", `let value: number | undefined = undefined;
value! = 2;
console.log(value);
`)
}
