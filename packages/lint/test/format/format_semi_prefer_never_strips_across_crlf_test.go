package linthost

import "testing"

// TestFormatSemiPreferNeverStripsAcrossCrlf verifies newline detection in
// the hazard scan counts CRLF line endings, so newline-separated
// statements in a CRLF source still lose their terminators under
// semi:false.
//
// The sawNewline discipline keeps same-line separators; if it only
// recognized bare `\n` after skipping `\r` as plain whitespace, a CRLF
// file would still strip correctly — but a scan that treated `\r\n` as
// no line break would wrongly keep every terminator. This pins the
// carriage-return branch of the trivia scanner in both directions:
// stripping fires, and the CRLF bytes survive the edit untouched.
//
//  1. Parse two CRLF-separated statements, the first ending in `;`.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the `;` is stripped and the `\r\n` endings are preserved.
func TestFormatSemiPreferNeverStripsAcrossCrlf(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "a = 1;\r\nb = 2\r\n",
    `{"prefer":"never"}`,
    "a = 1\r\nb = 2\r\n",
  )
}
