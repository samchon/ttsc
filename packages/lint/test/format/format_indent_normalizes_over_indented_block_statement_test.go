package linthost

import "testing"

// TestFormatIndentNormalizesOverIndentedBlockStatement verifies
// formatIndent re-indents a block statement to its depth-1 indent.
//
// A statement six spaces deep inside a single block should sit at two
// spaces (depth 1, tabWidth 2). This pins that the rule computes the
// target column from nesting depth and rewrites the over-indented run.
//
//  1. Parse a function whose body statement is indented six spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the statement is re-indented to two spaces.
func TestFormatIndentNormalizesOverIndentedBlockStatement(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/indent",
    "function f() {\n      const x = 1;\n}\n",
    "function f() {\n  const x = 1;\n}\n",
  )
}
