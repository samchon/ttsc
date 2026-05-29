package linthost

import "testing"

// TestFormatIndentStripsLeadingIndentFromTopLevelStatement verifies
// formatIndent removes the leading indentation of a top-level statement.
//
// Top-level statements live at depth 0, so the desired indent is the
// empty string. A leading two-space run differs from "" and is replaced,
// fixing the headline bug's stray leading indent.
//
//  1. Parse a file whose only statement is indented two spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the statement now starts at column 0.
func TestFormatIndentStripsLeadingIndentFromTopLevelStatement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "  const a = 1;\n",
    "const a = 1;\n",
  )
}
