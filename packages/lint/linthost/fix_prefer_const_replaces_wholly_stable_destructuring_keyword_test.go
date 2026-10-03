package linthost

import "testing"

// TestFixPreferConstReplacesWhollyStableDestructuringKeyword verifies shared-keyword fixing.
//
// Each binding in one initialized destructuring declaration is const-eligible,
// so their distinct findings may safely share one deduplicated `let` edit.
// The pattern, initializer, and references must otherwise remain untouched.
//
//  1. Declare and read two stable leaves in one destructuring declaration.
//  2. Apply all prefer-const findings through the disk-backed fix selector.
//  3. Assert the shared keyword changes exactly once from `let` to `const`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const changes the wholly stable left/right destructuring keyword to const.
// @evidence contracts/testing.md#independent-expectations Literal destructuring output preserves both leaves and initializer; shared edit deduplication must still yield one correct source.
// @evidence contracts/testing.md#distinguishing-cases Both leaves are stable, unlike the partially mutable destructuring no-fix case.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstReplacesWhollyStableDestructuringKeyword calls assertFixSnapshot with actual checker findings and disk edit deduplication.
func TestFixPreferConstReplacesWhollyStableDestructuringKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let { left, right } = { left: 1, right: 2 };\nconsole.log(left, right);\n",
    "const { left, right } = { left: 1, right: 2 };\nconsole.log(left, right);\n",
  )
}
