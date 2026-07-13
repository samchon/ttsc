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
func TestPreferConstCountsParenthesizedUpdateTargetBySymbol(t *testing.T) {
  assertRuleSkipsSource(t, "prefer-const", `let prefix = 0;
++(prefix);
let postfix = 0;
(postfix)++;
console.log(prefix, postfix);
`)
}
