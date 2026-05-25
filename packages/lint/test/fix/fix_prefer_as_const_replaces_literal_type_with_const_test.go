package linthost

import "testing"

// TestFixPreferAsConstReplacesLiteralTypeWithConst verifies the preferAsConst fixer.
//
// The detection guard already proves the literal text matches the
// assertion target, so replacing the literal type with the `const` keyword
// is safe. The fix should rewrite only the type-position node, leaving the
// expression's text untouched.
//
// 1. Parse a source file with `value as "literal"`.
// 2. Apply the preferAsConst finding through the disk-backed fixer.
// 3. Assert the type node changed to `const`.
func TestFixPreferAsConstReplacesLiteralTypeWithConst(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-as-const",
    "const value = \"literal\" as \"literal\";\nJSON.stringify(value);\n",
    "const value = \"literal\" as const;\nJSON.stringify(value);\n",
  )
}
