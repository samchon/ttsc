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
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must unquote the structural height member without changing its number annotation or type alias.
// @evidence contracts/testing.md#independent-expectations The complete literal output retains the height property name and number type; the supported quoteProps surface includes type-literal members rather than only object-expression properties.
// @evidence contracts/testing.md#distinguishing-cases This TypeLiteral positive complements the interface-holder and class-method positives; preservation and ineligible-key negatives distinguish eligibility from unconditional rewriting.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesTypeLiteralMember is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsUnquotesTypeLiteralMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "type Shape = { \"height\": number };\n",
    `{"mode":"as-needed"}`,
    "type Shape = { height: number };\n",
  )
}
