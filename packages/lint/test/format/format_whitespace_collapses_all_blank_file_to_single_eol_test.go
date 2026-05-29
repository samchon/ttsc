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
func TestFormatWhitespaceCollapsesAllBlankFileToSingleEOL(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "\n\n\n",
    "\n",
  )
}
