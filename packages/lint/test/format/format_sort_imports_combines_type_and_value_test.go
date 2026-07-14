package linthost

import "testing"

// TestFormatSortImportsCombinesTypeAndValue verifies combineTypeAndValue folds
// a type-only import into a value import of the same module.
//
// With the option on, the type-only specifiers move into the value declaration
// as inline `type` specifiers (ordered after the value specifiers); the merged
// declaration is no longer type-only.
//
//  1. Parse a value import and a type-only import of the same module.
//  2. Enable combineTypeAndValue and unsafe runtime sorting.
//  3. Assert one declaration with the value specifier before the inline `type`.
func TestFormatSortImportsCombinesTypeAndValue(t *testing.T) {
  source := "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo, type Bar } from \"m\";\n" +
    "foo;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
