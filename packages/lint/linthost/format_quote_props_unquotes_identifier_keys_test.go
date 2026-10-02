package linthost

import "testing"

// TestFormatQuotePropsUnquotesIdentifierKeys verifies quoteProps:"as-needed"
// (the default, matching Prettier) drops quotes from object keys that are
// valid identifiers.
//
//  1. Parse `{ "foo": 1, "bar": 2 }`.
//  2. Apply format/quote-props with mode:"as-needed".
//  3. Assert it becomes `{ foo: 1, bar: 2 }`.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must remove redundant foo and bar property-key quotes without changing their values or object membership.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves the two property keys and numeric values because foo and bar are valid IdentifierNames, and follows the supported as-needed spelling policy.
// @evidence contracts/testing.md#distinguishing-cases This two-key positive complements numeric-looking and punctuation-bearing negative keys; preserve mode supplies an adjacent option where otherwise-removable quotes must remain.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesIdentifierKeys is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsUnquotesIdentifierKeys(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const a = { \"foo\": 1, \"bar\": 2 };\n",
    `{"mode":"as-needed"}`,
    "const a = { foo: 1, bar: 2 };\n",
  )
}
