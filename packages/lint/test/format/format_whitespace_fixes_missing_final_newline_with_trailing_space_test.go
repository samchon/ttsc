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
func TestFormatWhitespaceFixesMissingFinalNewlineWithTrailingSpace(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1; ",
    "const a = 1;\n",
  )
}
