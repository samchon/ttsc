package linthost

import "testing"

// TestFormatSortImportsKeepsCommentedListUnmerged verifies that a named-import
// declaration whose braces carry a comment is NOT merged with another import of
// the same module. Merging rejoins specifier texts with ", " and would drop the
// comment; round-2 review found this data loss. The commented declaration stays
// separate so `/* keep */` survives.
func TestFormatSortImportsKeepsCommentedListUnmerged(t *testing.T) {
  // Without the fix the rule would merge these into `import { a, b } from "m";`
  // (a finding) and drop `/* keep */`. With the commented list unmergeable the
  // input is already canonical, so the rule reports nothing and the comment
  // survives.
  source := "import { a /* keep */ } from \"m\";\n" +
    "import { b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertRuleSkipsSource(t, "format/sort-imports", source)
}
