package linthost

import "testing"

// TestFormatSortImportsDedupesRepeatedSpecifier verifies merging duplicate
// modules collapses a specifier imported twice into a single entry.
//
// The merge step de-duplicates named specifiers by their emitted text, so two
// declarations each importing `{ a }` yield one `{ a }`.
//
//  1. Parse two imports of `{ a }` from the same module.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the merged declaration lists `a` once.
func TestFormatSortImportsDedupesRepeatedSpecifier(t *testing.T) {
  source := "import { a } from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n"
  expected := "import { a } from \"m\";\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
