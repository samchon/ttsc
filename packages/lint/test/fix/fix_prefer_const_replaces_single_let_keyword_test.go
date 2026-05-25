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
func TestFixPreferConstReplacesSingleLetKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-const",
    "let stable = 1;\nJSON.stringify(stable);\n",
    "const stable = 1;\nJSON.stringify(stable);\n",
  )
}
