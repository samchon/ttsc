package linthost

import "testing"

// TestFormatSortImportsMergesDuplicateModules verifies two value imports of the
// same module collapse into one declaration with the union of named specifiers.
//
// Duplicate runtime merging is available only through the explicit unsafe
// option; once enabled, the merged specifier list is de-duplicated and sorted.
//
//  1. Parse a file importing `{ b }` and `{ a }` from the same module.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert one merged, sorted declaration.
func TestFormatSortImportsMergesDuplicateModules(t *testing.T) {
  source := "import { b } from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a, b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
