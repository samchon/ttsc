package linthost

import "testing"

// TestFormatQuotePropsUnquotesIdentifierKeys verifies quoteProps:"as-needed"
// (the default, matching Prettier) drops quotes from object keys that are
// valid identifiers.
//
//  1. Parse `{ "foo": 1, "bar": 2 }`.
//  2. Apply format/quote-props with mode:"as-needed".
//  3. Assert it becomes `{ foo: 1, bar: 2 }`.
func TestFormatQuotePropsUnquotesIdentifierKeys(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const a = { \"foo\": 1, \"bar\": 2 };\n",
    `{"mode":"as-needed"}`,
    "const a = { foo: 1, bar: 2 };\n",
  )
}
