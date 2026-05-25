package linthost

import "testing"

// TestFormatQuotesConvertsSingleToDouble verifies the happy path: a plain
// single-quoted literal becomes double-quoted.
//
// The rule's promise is "double quotes win when escape cost is equal". A
// boring `'hello'` with no inner quotes has zero escapes on either side, so
// the tie-breaker must rewrite it. This scenario locks that tie-breaker so
// a future hostess that swaps the inequality cannot silently leave the
// existing literal untouched.
//
// 1. Parse a source file containing a single-quoted literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file uses double quotes.
func TestFormatQuotesConvertsSingleToDouble(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatQuotes",
    "const greeting = 'hello';\nJSON.stringify(greeting);\n",
    "const greeting = \"hello\";\nJSON.stringify(greeting);\n",
  )
}
