package linthost

import "testing"

// TestFixPreferConstReplacesSingleLetKeyword verifies preferConst autofix output.
//
// A single initialized `let` declaration can be rewritten by replacing the
// declaration keyword. The edit must not touch the binding name, initializer,
// comments, or statement terminator.
//
// 1. Parse a source file with an initialized `let` that is never reassigned.
// 2. Apply the preferConst finding's text edit through the disk-backed fixer.
// 3. Assert only `let` changed to `const`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const replaces only let with const for stable and preserves its initializer and call.
// @evidence contracts/testing.md#independent-expectations Literal const stable output independently specifies the initialized-never-reassigned binding contract.
// @evidence contracts/testing.md#distinguishing-cases A single stable declaration contrasts with bare loop writes and unsafe shared declaration lists.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstReplacesSingleLetKeyword invokes assertFixSnapshot with the checker-backed prefer-const rule.
func TestFixPreferConstReplacesSingleLetKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let stable = 1;\nJSON.stringify(stable);\n",
    "const stable = 1;\nJSON.stringify(stable);\n",
  )
}
