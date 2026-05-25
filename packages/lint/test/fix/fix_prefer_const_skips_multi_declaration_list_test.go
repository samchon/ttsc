package linthost

import "testing"

// TestFixPreferConstSkipsMultiDeclarationList verifies conservative preferConst fixing.
//
// The current native rule reports each declaration in a multi-declaration
// `let` list independently. Replacing the shared keyword would affect every
// declaration in the list, so the fixer must leave that source unchanged until
// the rule can split declarations safely.
//
// 1. Parse a `let` declaration list with two never-reassigned bindings.
// 2. Run preferConst and apply any offered text edits.
// 3. Assert diagnostics exist but no automatic edit is applied.
func TestFixPreferConstSkipsMultiDeclarationList(t *testing.T) {
  assertNoFixSnapshot(t, "prefer-const", "let left = 1, right = 2;\nJSON.stringify(left + right);\n")
}
