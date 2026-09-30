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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises display width and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: subscript_array_stays_flat, wide_hangul_identifier_overflows. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatDisplayWidth owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
