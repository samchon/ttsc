package linthost

import "testing"

// TestFormatSortImportsKeepsDefaultOnlyGapCommentUnmerged pins the merge guard
// for a comment in a DEFAULT-ONLY import's prefix (`import a /* keep */ from
// "m"`), which has no named bindings. The round-12 prefix scan was mis-scoped
// after the no-named-bindings early return, so a default-only import reached the
// mergeable path and the comment was dropped when merged with a same-module
// named import. With the scan hoisted before that return, the declaration stays
// unmergeable and the bytes survive.
func TestFormatSortImportsKeepsDefaultOnlyGapCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import a /* keep */ from "m";
import { b } from "m";
`)
}
