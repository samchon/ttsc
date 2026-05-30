package linthost

import "testing"

// TestFormatQuotePropsKeepsNonIdentifierKey verifies quoteProps:"as-needed"
// keeps the quotes on a key that is not a valid identifier (`"bar-baz"`),
// matching Prettier — only identifier keys are unquoted.
//
//  1. Parse `{ foo: 1, "bar-baz": 2 }`.
//  2. Run format/quote-props with mode:"as-needed".
//  3. Assert the rule reports nothing.
func TestFormatQuotePropsKeepsNonIdentifierKey(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const b = { foo: 1, \"bar-baz\": 2 };\n",
    `{"mode":"as-needed"}`,
  )
}
