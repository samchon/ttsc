package linthost

import "testing"

// TestFormatPrintWidthKeepsCallWithTrailingLineCommentInline prevents a
// trailing line comment from spending the call's layout budget. The call
// plus semicolon is 25 columns, whereas the complete comment line is 31;
// width 30 must leave this fitting call unchanged.
//
//  1. Configure printWidth=30 for the call followed by // hi.
//  2. Assert the rule reports no finding despite the comment-line overflow.
//
// @evidence contracts/testing.md#behavioral-verification format/print-width must emit zero findings for the fitting three-argument call whose trailing line comment alone extends past width 30. Charging the comment would spuriously break the call.
// @evidence contracts/testing.md#independent-expectations The authored unchanged input fixes the supported comment-only overflow boundary. Independently counted literal input lengths establish the 25-column statement and 31-column comment line without deriving the expectation from trailingLineWidth.
// @evidence contracts/testing.md#distinguishing-cases This host owns the comment-only overflow negative. TestFormatPrintWidthBreaksCallWhenTrailingSemicolonOverflows supplies a real suffix overflow positive and its exact-fit twin; direct suffix helpers distinguish line comments from block comments.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsCallWithTrailingLineCommentInline owns the configured source through assertRuleSkipsSourceWithOptions and the in-process rule engine. No consumer install, native build or product-host child is used.
func TestFormatPrintWidthKeepsCallWithTrailingLineCommentInline(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "myCall(arg1, arg2, arg3); // hi\n",
    `{"printWidth": 30}`,
  )
}
