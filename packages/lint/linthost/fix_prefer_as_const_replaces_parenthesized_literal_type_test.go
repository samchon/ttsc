package linthost

import "testing"

// TestFixPreferAsConstReplacesParenthesizedLiteralType verifies type-side
// parentheses follow typescript-estree's erased-parentheses semantics.
//
// The fixer removes only the parenthesis tokens and replaces the inner literal,
// preserving comments that sit inside the parenthesized type. Replacing only
// the literal would produce invalid `as (const)` syntax; replacing the whole
// wrapper would silently discard those comments.
//
// 1. Parse `"literal" as (/* keep */ "literal" /* tail */)`.
// 2. Apply the preferAsConst finding through the disk-backed fixer.
// 3. Assert the parentheses are gone, both comments remain and the type is `const`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const removes type-side parentheses and replaces the inner literal while keeping both internal comments.
// @evidence contracts/testing.md#independent-expectations The full literal as /* keep */ const /* tail */ result avoids invalid as (const) and preserves comment payloads.
// @evidence contracts/testing.md#distinguishing-cases Type wrappers require three token edits rather than a whole-wrapper deletion; expression wrappers are handled separately.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstReplacesParenthesizedLiteralType applies the actual rule via assertFixSnapshot.
func TestFixPreferAsConstReplacesParenthesizedLiteralType(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = \"literal\" as (/* keep */ \"literal\" /* tail */);\nJSON.stringify(value);\n",
    "const value = \"literal\" as /* keep */ const /* tail */;\nJSON.stringify(value);\n",
  )
}
