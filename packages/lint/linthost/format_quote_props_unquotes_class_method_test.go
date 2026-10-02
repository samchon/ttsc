package linthost

import "testing"

// TestFormatQuotePropsUnquotesClassMethod verifies class method names use the
// as-needed quote policy.
//
// Class fields intentionally preserve their quoted spelling, but methods are
// property names in Prettier's quoteProps surface and must not be skipped with
// their containing class declaration.
//
// 1. Parse a class with a quoted method name.
// 2. Apply format/quote-props with mode `as-needed`.
// 3. Assert the method name becomes an identifier.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must unquote the class run method name while preserving a neighboring quoted class field name.
// @evidence contracts/testing.md#independent-expectations The complete literal outputs retain the class, method body and added field initializer; independent Prettier 3.8.3 output unquotes methods but preserves quoted class fields, establishing the surface distinction.
// @evidence contracts/testing.md#distinguishing-cases The original method-only positive remains. The added same-class quoted field plus method fixture requires the method to change and the adjacent ordinary and __proto__ fields to stay quoted, distinguishing whole-class abstention from indiscriminate member unquoting.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesClassMethod is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsUnquotesClassMethod(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "class C { \"run\"() {} }\n",
    `{"mode":"as-needed"}`,
    "class C { run() {} }\n",
  )
  assertFixSnapshotWithOptions(t, "format/quote-props", "class C { \"field\" = 1; \"run\"() {} }\n", `{"mode":"as-needed"}`, "class C { \"field\" = 1; run() {} }\n")
  assertFixSnapshotWithOptions(t, "format/quote-props", "class C { \"__proto__\" = 1; \"run\"() {} }\n", `{"mode":"as-needed"}`, "class C { \"__proto__\" = 1; run() {} }\n")
}
