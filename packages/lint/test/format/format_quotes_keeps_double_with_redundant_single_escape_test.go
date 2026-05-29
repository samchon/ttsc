package linthost

import "testing"

// TestFormatQuotesKeepsDoubleWithRedundantSingleEscape verifies that a
// double-quoted literal carrying a redundant `\'` escape is left alone
// under prefer:"single".
//
// The cooked value `a'b` holds one single quote: double quotes spell it
// with zero escapes, single quotes need one (`'a\'b'`). Prettier 3.8.3
// keeps the double-quoted form because it is strictly cheaper, even under
// the single-quote preference. The escape counter must treat the
// redundant `\'` as a single-quote occurrence, or the literal looks like
// a 0-vs-0 tie and wrongly flips to single.
//
//  1. Parse a double-quoted literal with a redundant `\'`.
//  2. Run format/quotes with prefer:"single".
//  3. Assert the rule reports nothing (double quotes are cheaper, kept).
func TestFormatQuotesKeepsDoubleWithRedundantSingleEscape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quotes",
    "const a = \"a\\'b\";\n",
    `{"prefer":"single"}`,
  )
}
