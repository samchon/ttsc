package linthost

import "testing"

// TestFormatQuotePropsPreserveIsNoop verifies quoteProps:"preserve" never
// changes key quoting.
//
//  1. Parse `{ "foo": 1 }`.
//  2. Run format/quote-props with mode:"preserve".
//  3. Assert the rule reports nothing.
func TestFormatQuotePropsPreserveIsNoop(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const a = { \"foo\": 1 };\n",
    `{"mode":"preserve"}`,
  )
}
