package linthost

import "testing"

// TestFormatQuotePropsUnquotesInterfaceMember verifies interface members use
// the as-needed quote policy.
//
// Interface members are not object-literal properties, so the former visited
// set left their redundant quoted names untouched despite Prettier rewriting
// them.
//
// 1. Parse an interface with a quoted property name.
// 2. Apply format/quote-props with mode `as-needed`.
// 3. Assert the member name becomes an identifier.
func TestFormatQuotePropsUnquotesInterfaceMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "interface Shape { \"width\": number }\n",
    `{"mode":"as-needed"}`,
    "interface Shape { width: number }\n",
  )
}
