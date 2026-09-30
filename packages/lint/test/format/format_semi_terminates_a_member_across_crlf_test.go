package linthost

import "testing"

// TestFormatSemiTerminatesAMemberAcrossCrlf verifies the member insert
// recognizes a CRLF break, so a CRLF interface is terminated exactly like
// an LF one.
//
// The insert fires only when a line break separates the member from the
// next significant byte. A scan that read `\r` as ordinary whitespace
// rather than a line terminator would see the closing `}` as same-line and
// abstain, leaving every CRLF file unformatted while LF files converged.
// The `\r\n` bytes must also survive the edit, which is zero-width and so
// never rewrites them.
//
//  1. Parse a CRLF interface whose member carries no terminator.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert the `;` is inserted and the CRLF endings are preserved.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must recognize a CRLF-broken interface member and insert its semicolon without rewriting line-ending bytes or the string annotation.
// @evidence contracts/testing.md#independent-expectations The complete escaped output literal independently specifies the same CRLF source with one appended member terminator.
// @evidence contracts/testing.md#distinguishing-cases This changed CRLF single-member positive complements LF broken-interface insertion and one-line bare-member negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesAMemberAcrossCrlf is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiTerminatesAMemberAcrossCrlf(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "interface Shape {\r\n  value: string\r\n}\r\n",
    "interface Shape {\r\n  value: string;\r\n}\r\n",
  )
}
