package linthost

import "testing"

// TestFormatQuotePropsKeepsNonIdentifierKey verifies quoteProps:"as-needed"
// keeps the quotes on a key that is not a valid identifier (`"bar-baz"`),
// matching Prettier — only identifier keys are unquoted.
//
//  1. Parse `{ foo: 1, "bar-baz": 2 }`.
//  2. Run format/quote-props with mode:"as-needed".
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must leave the already-bare foo and necessary quoted bar-baz key without findings.
// @evidence contracts/testing.md#independent-expectations bar-baz contains punctuation and cannot be spelled as a bare IdentifierName. The fixed source is the independent canonical as-needed oracle and zero findings forbids removing its necessary quotes.
// @evidence contracts/testing.md#distinguishing-cases This hyphenated-key negative shares its exact object input with the consistent add-quote positive; identifier-only unquoting owns the adjacent removable-key behavior.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsKeepsNonIdentifierKey is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only harness invokes the owning rule in process for this host's literal input and zero-finding assertion. No consumer install, native product build or product host is started.
func TestFormatQuotePropsKeepsNonIdentifierKey(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/quote-props",
    "const b = { foo: 1, \"bar-baz\": 2 };\n",
    `{"mode":"as-needed"}`,
  )
}
