package linthost

import "testing"

// TestFormatQuotesEscapesDoubleQuoteWhenConverting verifies bare double
// quotes inside a convertible literal become `\"` after conversion.
//
// When escapedSingle and unescapedDouble are equal, the converter still
// rewrites (default prefers double). The output must escape any embedded
// double quote to remain syntactically valid. Without this branch the
// formatter would emit broken source like `"a"b\'c"` — the unit test
// makes the breakage impossible to ship.
//
// 1. Parse a source file with one mixed-quote single-quoted literal.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the embedded `"` is escaped and the embedded `\'` is bare.
func TestFormatQuotesEscapesDoubleQuoteWhenConverting(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatQuotes",
    "const mixed = 'a\"b\\'c';\nJSON.stringify(mixed);\n",
    "const mixed = \"a\\\"b'c\";\nJSON.stringify(mixed);\n",
  )
}
