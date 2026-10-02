package linthost

import "testing"

// TestFormatQuotePropsConsistentQuotesMixedObject verifies that `consistent`
// quotes an unquoted object key when a sibling requires quotes.
//
// The prior no-op fixture began in the final form and therefore could not
// detect the missing add-quote direction. Prettier's consistent mode chooses
// one spelling for the entire object key group.
//
// 1. Parse an object with an identifier key and a punctuation-bearing key.
// 2. Apply format/quote-props with mode `consistent`.
// 3. Assert the identifier key is quoted with its sibling.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props consistent mode must quote the bare foo key when bar-baz requires quotes, preserving both values and property names.
// @evidence contracts/testing.md#independent-expectations The complete literal output follows the supported object-wide consistency policy: bar-baz cannot be an IdentifierName, so foo gains quotes while retaining its string property key and value.
// @evidence contracts/testing.md#distinguishing-cases This add-quote positive starts with a genuinely mixed group; all-identifier consistent unquoting owns the opposite direction, and as-needed keeps-non-identifier owns the same input under a different mode.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsConsistentQuotesMixedObject is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsConsistentQuotesMixedObject(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const c = { foo: 1, \"bar-baz\": 2 };\n",
    `{"mode":"consistent"}`,
    "const c = { \"foo\": 1, \"bar-baz\": 2 };\n",
  )
}
