package linthost

import "testing"

// TestFormatSortImportsGroupsTypeOnlyImports verifies a <TYPES> group hoists
// `import type` declarations ahead of value imports.
//
// The placeholder matches type-only declarations regardless of specifier, so a
// `<TYPES>` group placed first pulls every `import type` to the top.
//
//  1. Parse a value import and a type-only import.
//  2. Apply that order with unsafe runtime sorting enabled.
//  3. Assert the type-only import sorts first.
func TestFormatSortImportsGroupsTypeOnlyImports(t *testing.T) {
  source := "import { a } from \"m\";\n" +
    "import type { B } from \"n\";\n" +
    "a;\n"
  expected := "import type { B } from \"n\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>","<THIRD_PARTY_MODULES>"],"unsafeSortRuntimeImports":true}`, expected)
}
