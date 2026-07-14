package linthost

import "testing"

// TestFormatSortImportsOrdersCaseInsensitivelyByDefault verifies module
// specifiers sort case-insensitively unless caseSensitive is set.
//
// `apple` and `React` interleave only under a case-folded comparison; the
// default lowercases both before comparing, so `apple` precedes `React`.
//
//  1. Parse imports of `React` and `apple`.
//  2. Enable unsafe runtime sorting with the default comparison mode.
//  3. Assert `apple` sorts before `React`.
func TestFormatSortImportsOrdersCaseInsensitivelyByDefault(t *testing.T) {
  source := "import React from \"React\";\n" +
    "import apple from \"apple\";\n" +
    "React;\n" +
    "apple;\n"
  expected := "import apple from \"apple\";\n" +
    "import React from \"React\";\n" +
    "React;\n" +
    "apple;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
