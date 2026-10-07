package linthost

import "testing"

// TestFormatQuotePropsPreserveIsNoop verifies quoteProps:"preserve" never
// changes key quoting.
//
//  1. Parse `{ "foo": 1 }`.
//  2. Run format/quote-props with mode:"preserve".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props preserve mode must report no finding for a quoted foo key that as-needed mode would otherwise remove.
// @evidence contracts/testing.md#independent-expectations The preserve option independently requires the existing literal spelling to stay untouched even though foo is a valid IdentifierName.
// @evidence contracts/testing.md#distinguishing-cases This option-controlled negative contrasts with the as-needed identifier-key positive and consistent mode transformations, preventing key eligibility alone from overriding preserve.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsPreserveIsNoop is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule in process for this host's literal input and zero-finding assertion. No consumer install, native product build or product host is started.
func TestFormatQuotePropsPreserveIsNoop(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const a = { \"foo\": 1 };\n",
    `{"mode":"preserve"}`,
  )
}
