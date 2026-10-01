package linthost

import "testing"

// TestCommandFormatDisplayWidth pins width decisions to display columns rather
// than byte length, matching Prettier's getStringWidth. A multi-byte token must
// be measured by the columns it occupies (a subscript digit is one column, a
// Hangul or CJK character two), not by its UTF-8 byte count, or the formatter
// over-counts the line and breaks where Prettier keeps it flat (or the reverse).
//
//  1. Exercise the authored command format display width fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification Two subcases run the in-process `format` command on authored fixed points: an array of ten quoted subscript digits that stays on one line, and a call with a five-character Hangul variable name whose arguments stay exploded, requiring each file unchanged.
// @evidence contracts/testing.md#independent-expectations Expectations are authored literals reasoned from display columns: the subscript array is 72 columns but 92 bytes, and the Hangul call is 79 columns by rune count but 84 by display width at printWidth 80; the expected text equals the input.
// @evidence contracts/testing.md#distinguishing-cases Subscript array distinguishes byte-length measurement (would explode) from column measurement; the Hangul call distinguishes per-rune counting (would join to one line) from width-aware counting. Both are fixed points, so each only catches the measurement error in one direction.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatDisplayWidth(t *testing.T) {
  // Ten quoted subscript digits: 93 bytes but ~70 columns, so the array stays
  // flat (a byte-length measure would wrongly explode it one per line).
  t.Run("subscript_array_stays_flat", func(t *testing.T) {
    assertFormatUnchanged(t,
      "const smallNumbers = [\"₀\", \"₁\", \"₂\", \"₃\", \"₄\", \"₅\", \"₆\", \"₇\", \"₈\", \"₉\"];\n")
  })
  // A wide Hangul identifier counts two columns per character. The flat call
  // is 79 columns by rune count but 84 by display width, so only a width-aware
  // measure explodes it (a narrow per-rune count would keep it inline).
  t.Run("wide_hangul_identifier_overflows", func(t *testing.T) {
    assertFormatUnchanged(t, "const 한국어변수 = someFunctionCall(\n  firstArgumentHere,\n  secondArgumentValueHere,\n  t3,\n);\n")
  })
}
