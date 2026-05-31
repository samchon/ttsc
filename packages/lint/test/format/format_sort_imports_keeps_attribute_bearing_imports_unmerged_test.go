package linthost

import "testing"

// TestFormatSortImportsKeepsAttributeBearingImportsUnmerged pins the merge guard
// for import attributes. renderMergedDecl rebuilds an import field-by-field and
// does not reconstruct a `with { … }` / `assert { … }` clause, so merging two
// same-module attribute-bearing imports would silently drop the attribute bytes.
// Flagging an attribute-bearing declaration unmergeable keeps each import's
// original text (attributes included).
func TestFormatSortImportsKeepsAttributeBearingImportsUnmerged(t *testing.T) {
  assertRuleSkipsSource(t, "format/sort-imports", `import { a } from "x" with { type: "json" };
import { b } from "x" with { type: "json" };
`)
}
