package linthost

import "testing"

// TestFormatQuotePropsConsistentKeepsAllQuotedForProto verifies that under
// quoteProps:"consistent" a "__proto__" key forces the whole object to stay
// quoted. "__proto__" must stay quoted to preserve semantics, so it counts as
// a must-stay-quoted key and, in consistent mode, the otherwise-removable
// `"foo"` is left quoted too.
//
//  1. Parse `{ "__proto__": 1, "foo": 2 }` with mode:"consistent".
//  2. Run format/quote-props.
//  3. Assert the rule reports nothing (every key stays quoted).
func TestFormatQuotePropsConsistentKeepsAllQuotedForProto(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const c = { \"__proto__\": 1, \"foo\": 2 };\n",
    `{"mode":"consistent"}`,
  )
}
