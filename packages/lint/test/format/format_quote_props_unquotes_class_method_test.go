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
func TestFormatQuotePropsUnquotesClassMethod(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "class C { \"run\"() {} }\n",
    `{"mode":"as-needed"}`,
    "class C { run() {} }\n",
  )
}
