package linthost

import "testing"

// TestPreferConstCountsParenthesizedUpdateTargetBySymbol verifies wrapped updates remain mutable.
//
// Prefix and postfix update operands may be parenthesized even though the
// underlying binding is the write target. Normalizing those operands through
// the shared target walker prevents prefer-const from missing either update.
//
//  1. Initialize separate prefix and postfix update bindings.
//  2. Update each binding through a parenthesized operand.
//  3. Assert prefer-const emits no finding for either mutable binding.
//
// @evidence contracts/testing.md#behavioral-verification The type-aware Engine stays silent for both initialized bindings updated through parenthesized prefix and postfix operands.
// @evidence contracts/testing.md#independent-expectations Parentheses do not introduce new bindings or turn updates into reads; the independent zero-finding expectation follows each real reassignment.
// @evidence contracts/testing.md#distinguishing-cases Prefix and postfix wrapped updates are both retained; the write-form and corpus tests own the unchanged reportable controls.
// @evidence contracts/testing.md#execution-ownership TestPreferConstCountsParenthesizedUpdateTargetBySymbol owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes the owning operation with a real Program and Checker and isolated fixture files, without a consumer install, native artifact build or product host.
func TestPreferConstCountsParenthesizedUpdateTargetBySymbol(t *testing.T) {
  assertRuleSkipsSource(t, "prefer-const", `let prefix = 0;
++(prefix);
let postfix = 0;
(postfix)++;
console.log(prefix, postfix);
`)
}
