package linthost

import "testing"

// TestPreferConstHonorsIgnoreReadBeforeAssignForShorthandRead verifies shorthand reads resolve to values.
//
// The checker exposes a property symbol for a shorthand property name unless
// callers request its value symbol. Resolving that value binding ensures an
// object-literal read before assignment activates ignoreReadBeforeAssign.
//
//  1. Read a declaration-only binding through an object-literal shorthand.
//  2. Assign the binding once and enable ignoreReadBeforeAssign.
//  3. Assert prefer-const suppresses the read-before-assignment binding.
func TestPreferConstHonorsIgnoreReadBeforeAssignForShorthandRead(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "prefer-const",
    `let value: number;
console.log({ value });
value = 1;
console.log(value);
`,
    `{"ignoreReadBeforeAssign":true}`,
  )
}
