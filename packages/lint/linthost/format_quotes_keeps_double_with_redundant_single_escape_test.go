package linthost

import "testing"

// TestFormatQuotesKeepsDoubleWithRedundantSingleEscape verifies that a
// double-quoted literal carrying a redundant `\'` escape is left alone
// under prefer:"single".
//
// The cooked value `a'b` holds one single quote: double quotes spell it
// with zero required escapes, while single quotes need one. The supported
// policy retains the cheaper delimiter even under the single preference.
// This rule does not normalize the redundant backslash. The counter must treat
// redundant `\'` as a single-quote occurrence, or the literal looks like
// a 0-vs-0 tie and wrongly flips to single.
//
//  1. Parse a double-quoted literal with a redundant `\'`.
//  2. Run format/quotes with prefer:"single".
//  3. Assert the rule reports nothing (double quotes are cheaper, kept).
//
// @evidence contracts/testing.md#behavioral-verification format/quotes must not change a double-quoted a-apostrophe-b payload under prefer:single when that preferred delimiter needs more escapes.
// @evidence contracts/testing.md#independent-expectations The literal source encodes a'b; zero required escapes with double versus one with single makes delimiter retention correct under the supported escape-cost policy. This rule leaves the redundant backslash untouched and does not claim reference-normalized full bytes.
// @evidence contracts/testing.md#distinguishing-cases This redundant escaped apostrophe must count toward the cooked payload rather than look like a zero-cost tie; the mixed conversion sibling owns a case that actually changes.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotesKeepsDoubleWithRedundantSingleEscape is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its literal source and no-finding assertions; the shared syntax-only harness invokes the owning rule in process without a consumer install, native product build or product host.
func TestFormatQuotesKeepsDoubleWithRedundantSingleEscape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quotes",
    "const a = \"a\\'b\";\n",
    `{"prefer":"single"}`,
  )
}
