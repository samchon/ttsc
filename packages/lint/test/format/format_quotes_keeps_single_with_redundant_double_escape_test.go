package linthost

import "testing"

// TestFormatQuotesKeepsSingleWithRedundantDoubleEscape is the mirror of
// TestFormatQuotesKeepsDoubleWithRedundantSingleEscape: a single-quoted
// literal carrying a redundant `\"` escape is left alone under
// prefer:"double".
//
// The cooked value `a"b` holds one double quote: single quotes spell it
// with zero escapes, double quotes need one (`"a\"b"`). Prettier 3.8.3
// keeps the single-quoted form because it is strictly cheaper, even under
// the double-quote preference. The escape counter must treat the
// redundant `\"` as a double-quote occurrence.
//
//  1. Parse a single-quoted literal with a redundant `\"`.
//  2. Run format/quotes with prefer:"double".
//  3. Assert the rule reports nothing (single quotes are cheaper, kept).
func TestFormatQuotesKeepsSingleWithRedundantDoubleEscape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quotes",
    "const b = 'a\\\"b';\n",
    `{"prefer":"double"}`,
  )
}
