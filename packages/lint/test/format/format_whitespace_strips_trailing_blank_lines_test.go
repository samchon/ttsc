package linthost

import "testing"

// TestFormatWhitespaceStripsTrailingBlankLines verifies formatWhitespace
// removes trailing blank lines and leaves exactly one final newline.
//
// Prettier ends a file with a single newline. This pins operation (d):
// the trailing blank lines and stray whitespace after the last statement
// collapse to one EOL.
//
//  1. Parse a statement followed by several blank/whitespace-only lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file ends with one newline after the statement.
func TestFormatWhitespaceStripsTrailingBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\n\n\n  \n",
    "const a = 1;\n",
  )
}
