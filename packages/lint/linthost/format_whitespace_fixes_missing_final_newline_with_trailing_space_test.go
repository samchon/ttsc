package linthost

import "testing"

// TestFormatWhitespaceFixesMissingFinalNewlineWithTrailingSpace verifies
// the rule trims a trailing space on the last line and appends the
// missing final newline in one pass.
//
// The last content line owns its tail through branch (d): the rule
// replaces everything after the last visible byte with a single EOL, so a
// `const a = 1; ` with no newline becomes `const a = 1;\n`. This pins the
// combined trailing-trim plus final-newline insertion on the final line.
//
//  1. Parse a single statement ending in a space with no final newline.
//  2. Apply the rule through the disk-backed fixer.
//  3. Assert the trailing space is gone and one newline is appended.
//
// @evidence contracts/testing.md#behavioral-verification format/whitespace must remove a final stray space and append one LF in the same fix without changing the declaration.
// @evidence contracts/testing.md#independent-expectations The complete independent output specifies both tail corrections and otherwise identical source tokens.
// @evidence contracts/testing.md#distinguishing-cases This combined defect must change in both respects; bare missing-EOL insertion and trailing-blank collapse own neighboring cases.
// @evidence contracts/testing.md#execution-ownership TestFormatWhitespaceFixesMissingFinalNewlineWithTrailingSpace is a public Go unit selected by TestSelectedLintUnits. This host owns every literal input and assertion; the shared syntax-only harness invokes the whitespace rule and applies edits for complete output comparisons in the same process without a consumer install, native product build or product host.
func TestFormatWhitespaceFixesMissingFinalNewlineWithTrailingSpace(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1; ",
    "const a = 1;\n",
  )
}
