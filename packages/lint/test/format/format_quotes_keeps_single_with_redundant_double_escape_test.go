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
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must retain the single-quoted a-double-quote-b payload under prefer:double because the preferred delimiter would require an escape.
// @evidence contracts/testing.md#independent-expectations The literal source encodes a"b; the supported minimum-required-escape policy preserves its cheaper single delimiter and existing redundant escape, matching Prettier 3.8.3.
// @evidence contracts/testing.md#distinguishing-cases This redundant escaped double quote is the mirror of the escaped-apostrophe negative; default-double tie conversion distinguishes this strict-cost abstention.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesKeepsSingleWithRedundantDoubleEscape is a public Go unit selected by TestSelectedLintUnits. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatQuotesKeepsSingleWithRedundantDoubleEscape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quotes",
    "const b = 'a\\\"b';\n",
    `{"prefer":"double"}`,
  )
}
