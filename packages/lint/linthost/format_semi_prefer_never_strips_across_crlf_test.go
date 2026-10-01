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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove the safe first statement terminator across CRLF while leaving the second assignment and both CRLF endings intact.
// @evidence contracts/testing.md#independent-expectations The independently authored full output follows newline-separated safe ASI and specifies exact CRLF preservation rather than matching visual lines alone.
// @evidence contracts/testing.md#distinguishing-cases One removable terminator followed by an unterminated assignment is the changed CRLF counterpart to LF stripping, contrasting with same-line separators that must survive.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsAcrossCrlf is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiPreferNeverStripsAcrossCrlf(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "a = 1;\r\nb = 2\r\n",
    `{"prefer":"never"}`,
    "a = 1\r\nb = 2\r\n",
  )
}
