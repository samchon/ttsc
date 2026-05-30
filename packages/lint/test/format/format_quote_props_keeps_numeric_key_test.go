package linthost

import "testing"

// TestFormatQuotePropsKeepsNumericKey verifies quoteProps:"as-needed" keeps a
// numeric-looking string key quoted (`"123"`), matching Prettier — unquoting
// it would change the key's meaning, so it is never removed.
//
//  1. Parse `{ "123": 1 }`.
//  2. Run format/quote-props with mode:"as-needed".
//  3. Assert the rule reports nothing.
func TestFormatQuotePropsKeepsNumericKey(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const e = { \"123\": 1 };\n",
    `{"mode":"as-needed"}`,
  )
}
