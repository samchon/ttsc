package linthost

import "testing"

// TestFormatQuotesUnescapesApostropheWhenConverting verifies the conversion
// rewrites `\'` to bare `'` when wrapping with double quotes.
//
// The reverse of the unescaped-`"` case: `'don\'t'` has one escaped quote
// in the source. Converting to double quotes makes that escape unnecessary,
// so the rule should emit `"don't"`. Without this branch the formatter
// would produce valid-but-uglified `"don\'t"` output and reformat-twice
// could end up oscillating between forms.
//
//  1. Parse a source file with one escaped apostrophe in a single-quoted
//     literal.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the converted text drops the redundant backslash.
func TestFormatQuotesUnescapesApostropheWhenConverting(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatQuotes",
    "const phrase = 'don\\'t';\nJSON.stringify(phrase);\n",
    "const phrase = \"don't\";\nJSON.stringify(phrase);\n",
  )
}
