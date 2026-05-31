package linthost

import "testing"

// TestFormatSortImportsKeepsCommentedListUnmerged verifies that a named-import
// declaration whose braces carry a comment is NOT merged with another import of
// the same module. Merging rejoins specifier texts with ", " and would drop the
// comment; round-2 review found this data loss. The commented declaration stays
// separate so `/* keep */` survives.
func TestFormatSortImportsKeepsCommentedListUnmerged(t *testing.T) {
  source := "import { a /* keep */ } from \"m\";\n" +
    "import { b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshot(t, "format/sort-imports", source, source)
}
