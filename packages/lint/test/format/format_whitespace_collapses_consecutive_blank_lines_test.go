package linthost

import "testing"

// TestFormatWhitespaceCollapsesConsecutiveBlankLines verifies
// formatWhitespace collapses a run of multiple blank lines between two
// statements to exactly one blank line.
//
// Prettier keeps at most one consecutive blank line. This pins operation
// (b): three blank lines between two statements become one.
//
//  1. Parse two statements separated by three blank lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert exactly one blank line remains between them.
func TestFormatWhitespaceCollapsesConsecutiveBlankLines(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;\n\n\n\nconst b = 2;\n",
    "const a = 1;\n\nconst b = 2;\n",
  )
}
