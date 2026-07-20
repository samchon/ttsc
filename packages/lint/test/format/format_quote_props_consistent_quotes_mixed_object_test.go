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
func TestFormatQuotePropsConsistentQuotesMixedObject(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const c = { foo: 1, \"bar-baz\": 2 };\n",
    `{"mode":"consistent"}`,
    "const c = { \"foo\": 1, \"bar-baz\": 2 };\n",
  )
}
