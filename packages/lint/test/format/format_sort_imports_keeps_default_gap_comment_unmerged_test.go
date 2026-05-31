package linthost

import "testing"

// TestFormatSortImportsKeepsDefaultGapCommentUnmerged pins the merge data-safety
// guard for a comment OUTSIDE the named-import braces. The round-2 guard scanned
// only the `{ … }` span, so a comment in the default-binding gap
// (`import D /* keep */, { a } from "m"`) left the import mergeable; merging with
// a second import of "m" rebuilt the statement field-by-field and dropped the
// comment. The widened prefix scan keeps the declaration unmergeable, so the
// rule makes no edit and the bytes survive.
func TestFormatSortImportsKeepsDefaultGapCommentUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import D /* keep */, { a } from "m";
import { b } from "m";
`)
}
