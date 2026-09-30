package linthost

import "testing"

// TestFormatWhitespaceCollapsesAllBlankFileToSingleEOL verifies a file
// of only blank lines collapses to a single EOL.
//
// With no content line to anchor against, the rule replaces the whole
// whitespace-only file with one EOL. This pins the all-blank branch,
// distinct from the leading/trailing-blank trimming that needs a content
// anchor.
//
//  1. Parse a file holding only blank lines.
//  2. Apply the rule through the disk-backed fixer.
//  3. Assert the file reduces to a single newline.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must collapse nonempty whitespace-only sources to one configured EOL rather than treat them as zero-length source.
// @evidence contracts/testing.md#independent-expectations Independent LF/CRLF literals specify the normalized empty-content representation; the input spaces/tabs carry no declaration or string payload.
// @evidence contracts/testing.md#distinguishing-cases Blank LF runs and added mixed space/tab LF/CRLF runs change; the truly empty negative distinguishes absent input from nonempty blank source.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceCollapsesAllBlankFileToSingleEOL is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceCollapsesAllBlankFileToSingleEOL(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "\n\n\n",
    "\n",
  )
  assertFixSnapshot(t, "format/whitespace", " \t\n\t \n", "\n")
  assertFixSnapshotWithOptions(t, "format/whitespace", " \t\r\n\t \r\n", `{"endOfLine":"crlf"}`, "\r\n")
}
