package linthost

import "testing"

// TestFormatWhitespaceInsertsMissingFinalNewline verifies
// formatWhitespace appends a final newline to a file that ends without
// one.
//
// Prettier guarantees a trailing newline. This pins the no-newline arm
// of operation (d): a file whose last byte is a statement terminator
// gains exactly one EOL.
//
//  1. Parse a single statement with no terminating newline.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the file now ends with one newline.
func TestFormatWhitespaceInsertsMissingFinalNewline(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;",
    "const a = 1;\n",
  )
}
