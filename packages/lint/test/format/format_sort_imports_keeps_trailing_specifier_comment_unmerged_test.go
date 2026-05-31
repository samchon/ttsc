package linthost

import "testing"

// TestFormatSortImportsKeepsTrailingSpecifierCommentUnmerged pins the merge guard
// for a block comment in the module-specifier -> `;` tail
// (`import { a } from "m" /* keep */;`). That comment is interior to the
// declaration but outside the inter-declaration gap, so without the tail scan the
// import stayed mergeable and the comment was dropped on merge with a same-module
// sibling. The tail scan keeps it unmergeable; the bytes survive.
func TestFormatSortImportsKeepsTrailingSpecifierCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import { a } from "m" /* keep */;
import { b } from "m";
`)
}
