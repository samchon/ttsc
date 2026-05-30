package linthost

import "testing"

// TestFormatQuotesSwitchesDoubleToSingleToMinimizeEscapes verifies the
// rule flips an already-double-quoted literal to single quotes when that
// strictly reduces escapes, even under the default prefer:"double".
//
// Prettier chooses the quote that yields fewer escapes and only honors
// the configured preference on a tie. The old rule only converted
// single->double and never re-examined a double-quoted literal, so
// `"\""` (one escape) was left alone instead of becoming `'"'` (zero).
//
//  1. Parse a source file with a double-quoted literal holding one
//     escaped double quote.
//  2. Apply the rule through the disk-backed fixer (default options).
//  3. Assert the literal is rewritten to the zero-escape single-quoted
//     form.
func TestFormatQuotesSwitchesDoubleToSingleToMinimizeEscapes(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/quotes",
    `const s = "\"";`+"\n",
    `const s = '"';`+"\n",
  )
}
