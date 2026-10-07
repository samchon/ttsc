package linthost

import "testing"

// TestFormatQuotePropsUnquotesReservedWordKey verifies quoteProps:"as-needed"
// unquotes a reserved-word key (`"default"`) — reserved words are valid
// property names, so Prettier drops the quotes.
//
//  1. Parse `{ "default": 1 }`.
//  2. Apply format/quote-props with mode:"as-needed".
//  3. Assert it becomes `{ default: 1 }`.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must unquote the default property key while preserving the numeric value and object declaration.
// @evidence contracts/testing.md#independent-expectations ECMAScript property names accept IdentifierName, including the reserved word default. The complete literal output therefore preserves the same property key and value under the supported as-needed policy.
// @evidence contracts/testing.md#distinguishing-cases This reserved-word positive distinguishes valid property names from variable-identifier restrictions; the hyphenated and leading-digit string negatives own truly ineligible quoted spellings.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesReservedWordKey is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsUnquotesReservedWordKey(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const f = { \"default\": 1 };\n",
    `{"mode":"as-needed"}`,
    "const f = { default: 1 };\n",
  )
}
