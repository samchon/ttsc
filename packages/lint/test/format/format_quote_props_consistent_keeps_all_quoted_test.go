package linthost

import "testing"

// TestFormatQuotePropsConsistentKeepsAllQuoted verifies quoteProps:
// "consistent" leaves every key quoted when one key needs quotes
// (`"bar-baz"`), matching Prettier — the object stays uniformly quoted.
//
//  1. Parse `{ "foo": 1, "bar-baz": 2 }`.
//  2. Run format/quote-props with mode:"consistent".
//  3. Assert the rule reports nothing (the removable `"foo"` stays quoted).
func TestFormatQuotePropsConsistentKeepsAllQuoted(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const c = { \"foo\": 1, \"bar-baz\": 2 };\n",
    `{"mode":"consistent"}`,
  )
}
