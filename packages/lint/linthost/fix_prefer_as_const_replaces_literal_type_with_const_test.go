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
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const changes the matching literal assertion type to const.
// @evidence contracts/testing.md#independent-expectations The literal as const result preserves the string expression and trailing call; the oracle does not reuse rule output.
// @evidence contracts/testing.md#distinguishing-cases The plain matching string literal is positive; null and template literal assertions remain silent in separate cases.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstReplacesLiteralTypeWithConst runs assertFixSnapshot on its matching assertion.
func TestFixPreferAsConstReplacesLiteralTypeWithConst(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = \"literal\" as \"literal\";\nJSON.stringify(value);\n",
    "const value = \"literal\" as const;\nJSON.stringify(value);\n",
  )
}
