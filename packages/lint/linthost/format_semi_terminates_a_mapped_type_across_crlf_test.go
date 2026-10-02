package linthost

import "testing"

// TestFormatSemiTerminatesAMappedTypeAcrossCrlf verifies the mapped-type
// path reads a CRLF break everywhere it reads a line break.
//
// The mapped path adds three line-structure readers at once: the wrap test
// at the `{`, the walk that finds the clause's end, and the scan that
// decides which side of a trailing comment the terminator falls on. The
// last of those is hand-rolled rather than shared with scanPastTrivia,
// because it has to stop at a line comment and step over a same-line block
// comment, so a `\r` it mistook for ordinary whitespace would push the `;`
// onto the following line's bytes. Both mapped types below must come out
// the way their LF twins do, with the `\r\n` endings untouched.
//
//  1. Parse a CRLF broken mapped type and one trailed by a block comment.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert both gain a `;` and every ending stays CRLF.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must append the plain and block-comment-trailed mapped-clause terminators without changing any CRLF separator or note comment.
// @evidence contracts/testing.md#independent-expectations The complete escaped output literal independently specifies every original CRLF byte and the correct plain/after-block-comment insertion position.
// @evidence contracts/testing.md#distinguishing-cases Two changed CRLF mapped types complement LF modifier/comment positives; exact full output distinguishes correct punctuation from a stray insertion on the following CR byte.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesAMappedTypeAcrossCrlf is a public Go unit selected by the lint semantic-unit Evidence claim. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
func TestFormatSemiTerminatesAMappedTypeAcrossCrlf(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type Plain = {\r\n  [K in string]: string\r\n};\r\n"+
      "type Noted = {\r\n  [K in string]: string /* note */\r\n};\r\n",
    "type Plain = {\r\n  [K in string]: string;\r\n};\r\n"+
      "type Noted = {\r\n  [K in string]: string /* note */;\r\n};\r\n",
  )
}
