package linthost

import "testing"

// TestFormatQuotePropsKeepsNumericKey verifies that the conservative as-needed
// policy retains quoted numeric-looking string keys, matching Prettier.
// Numeric-looking keys remain outside identifier unquoting.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must retain the quoted numeric-looking string key 123 without findings.
// @evidence contracts/testing.md#independent-expectations The supported conservative quoting policy removes only identifier-shaped keys, and the independently checked Prettier 3.8.3 result retains this quoted numeric key. This is a spelling policy, not a claim that numeric 123 would name a different property.
// @evidence contracts/testing.md#distinguishing-cases This leading-digit negative distinguishes numeric-looking strings from removable alphabetic keys; the hyphenated-key negative covers a different non-identifier boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsKeepsNumericKey is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning rule in process for this host's literal input and zero-finding assertion. No consumer install, native product build or product host is started.
func TestFormatQuotePropsKeepsNumericKey(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const e = { \"123\": 1 };\n",
    `{"mode":"as-needed"}`,
  )
}
