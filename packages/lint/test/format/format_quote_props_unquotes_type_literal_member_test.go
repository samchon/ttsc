package linthost

import "testing"

// TestFormatQuotePropsUnquotesTypeLiteralMember verifies type-literal
// members use the as-needed quote policy.
//
// A type literal has its own member list rather than an object-literal
// property list. Visiting it prevents the same quoted identifier divergence
// from reappearing in structural type declarations.
//
// 1. Parse a type literal with a quoted property name.
// 2. Apply format/quote-props with mode `as-needed`.
// 3. Assert the member name becomes an identifier.
func TestFormatQuotePropsUnquotesTypeLiteralMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "type Shape = { \"height\": number };\n",
    `{"mode":"as-needed"}`,
    "type Shape = { height: number };\n",
  )
}
