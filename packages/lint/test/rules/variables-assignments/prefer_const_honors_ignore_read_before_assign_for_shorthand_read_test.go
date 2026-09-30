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
//
// @evidence contracts/testing.md#behavioral-verification The real Checker-backed Engine emits no finding when an object shorthand reads a declaration-only binding before its sole assignment with the option enabled.
// @evidence contracts/testing.md#independent-expectations Shorthand property value resolution denotes the variable binding; the read-before-assignment policy supplies the independent clean expectation.
// @evidence contracts/testing.md#distinguishing-cases This owns shorthand value-symbol lookup under the enabled option; TestPreferConstHonorsIgnoreReadBeforeAssign owns default and ordinary closure-read comparisons.
// @evidence contracts/testing.md#execution-ownership TestPreferConstHonorsIgnoreReadBeforeAssignForShorthandRead owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes the owning operation with a real Program and Checker and isolated fixture files, without a consumer install, native artifact build or product host.
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
