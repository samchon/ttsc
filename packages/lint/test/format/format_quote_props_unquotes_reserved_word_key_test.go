package linthost

import "testing"

// TestFormatQuotePropsUnquotesReservedWordKey verifies quoteProps:"as-needed"
// unquotes a reserved-word key (`"default"`) — reserved words are valid
// property names, so Prettier drops the quotes.
//
//  1. Parse `{ "default": 1 }`.
//  2. Apply format/quote-props with mode:"as-needed".
//  3. Assert it becomes `{ default: 1 }`.
func TestFormatQuotePropsUnquotesReservedWordKey(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const f = { \"default\": 1 };\n",
    `{"mode":"as-needed"}`,
    "const f = { default: 1 };\n",
  )
}
