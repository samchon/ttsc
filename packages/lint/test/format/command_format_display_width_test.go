package linthost

import "testing"

// TestCommandFormatDisplayWidth pins width decisions to display columns rather
// than byte length, matching Prettier's getStringWidth. A multi-byte token must
// be measured by the columns it occupies (a subscript digit is one column, a
// Hangul or CJK character two), not by its UTF-8 byte count, or the formatter
// over-counts the line and breaks where Prettier keeps it flat (or the reverse).
func TestCommandFormatDisplayWidth(t *testing.T) {
  // Ten quoted subscript digits: 93 bytes but ~70 columns, so the array stays
  // flat (a byte-length measure would wrongly explode it one per line).
  t.Run("subscript_array_stays_flat", func(t *testing.T) {
    assertFormatUnchanged(t,
      "const smallNumbers = [\"₀\", \"₁\", \"₂\", \"₃\", \"₄\", \"₅\", \"₆\", \"₇\", \"₈\", \"₉\"];\n")
  })
  // A wide Hangul identifier counts two columns per character, pushing the call
  // past printWidth so its arguments explode (a narrow per-rune count would
  // wrongly keep it inline).
  t.Run("wide_hangul_identifier_overflows", func(t *testing.T) {
    assertFormatUnchanged(t, "const 한국어변수 = someFunctionCall(\n  firstArgumentHere,\n  secondArgumentValueHere,\n  third,\n);\n")
  })
}
