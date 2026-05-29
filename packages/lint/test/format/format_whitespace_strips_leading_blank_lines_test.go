package linthost

import "testing"

// TestFormatWhitespaceStripsLeadingBlankLines verifies formatWhitespace
// removes blank lines at the start of the file.
//
// Prettier never keeps leading blank lines before the first token. This
// pins operation (c): the two empty lines preceding the first statement
// are removed.
//
//  1. Parse a file that opens with two blank lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file now starts with the first statement.
func TestFormatWhitespaceStripsLeadingBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "\n\nconst a = 1;\n",
    "const a = 1;\n",
  )
}
