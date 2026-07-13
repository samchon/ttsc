package linthost

import "testing"

// TestFixPreferConstReplacesWhollyStableDestructuringKeyword verifies shared-keyword fixing.
//
// Each binding in one initialized destructuring declaration is const-eligible,
// so their identical findings may safely share one deduplicated `let` edit.
// The pattern, initializer, and references must otherwise remain untouched.
//
//  1. Declare and read two stable leaves in one destructuring declaration.
//  2. Apply all prefer-const findings through the disk-backed fix selector.
//  3. Assert the shared keyword changes exactly once from `let` to `const`.
func TestFixPreferConstReplacesWhollyStableDestructuringKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let { left, right } = { left: 1, right: 2 };\nconsole.log(left, right);\n",
    "const { left, right } = { left: 1, right: 2 };\nconsole.log(left, right);\n",
  )
}
