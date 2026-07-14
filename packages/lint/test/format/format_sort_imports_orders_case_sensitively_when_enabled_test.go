package linthost

import "testing"

// TestFormatSortImportsOrdersCaseSensitivelyWhenEnabled verifies caseSensitive
// switches to raw ASCII ordering (uppercase before lowercase).
//
// Under ASCII order `React` (R=0x52) precedes `apple` (a=0x61), the opposite of
// the case-insensitive default, isolating the caseSensitive branch.
//
//  1. Parse imports of `apple` and `React`.
//  2. Enable caseSensitive and unsafe runtime sorting.
//  3. Assert `React` sorts before `apple`.
func TestFormatSortImportsOrdersCaseSensitivelyWhenEnabled(t *testing.T) {
  source := "import apple from \"apple\";\n" +
    "import React from \"React\";\n" +
    "React;\n" +
    "apple;\n"
  expected := "import React from \"React\";\n" +
    "import apple from \"apple\";\n" +
    "React;\n" +
    "apple;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"caseSensitive":true,"unsafeSortRuntimeImports":true}`, expected)
}
