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
//
// @evidence contracts/testing.md#behavioral-verification Two m value declarations must merge into alphabetical a,b while preserving both subsequent uses.
// @evidence contracts/testing.md#independent-expectations The supported unsafe same-module merge contract unions distinct local bindings. The authored whole-file literal independently preserves the module and both names while fixing their order.
// @evidence contracts/testing.md#distinguishing-cases Distinct a/b bindings contribute to one module, unlike repeated-local deduplication and conflicting-default protection; the safe runtime block host covers absent permission.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsMergesDuplicateModules owns the authored same-module value merge snapshot and unsafe options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
