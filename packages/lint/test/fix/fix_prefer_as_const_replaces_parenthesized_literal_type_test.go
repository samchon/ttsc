package linthost

import "testing"

// TestFixPreferAsConstReplacesParenthesizedLiteralType verifies type-side
// parentheses follow typescript-estree's erased-parentheses semantics.
//
// The fixer removes only the parenthesis tokens and replaces the inner literal,
// preserving comments that sit inside the parenthesized type. Replacing only
// the literal would produce invalid `as (const)` syntax; replacing the whole
// wrapper would silently discard those comments.
func TestFixPreferAsConstReplacesParenthesizedLiteralType(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = \"literal\" as (/* keep */ \"literal\" /* tail */);\nJSON.stringify(value);\n",
    "const value = \"literal\" as /* keep */ const /* tail */;\nJSON.stringify(value);\n",
  )
}
