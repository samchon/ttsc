package linthost

import "testing"

// TestFormatSortImportsKeepsConflictingDefaultsSeparate verifies two distinct
// default imports of the same module are not merged.
//
// Merging would have to pick one default name; the rule declines and keeps both
// declarations, still grouped and sorted relative to other modules.
//
//  1. Parse a file with two different defaults from the same module plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the conflicting defaults remain two declarations.
func TestFormatSortImportsKeepsConflictingDefaultsSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import b from \"m\";\n" +
    "import a from \"m\";\n" +
    "z;\n" +
    "a;\n" +
    "b;\n"
  expected := "import b from \"m\";\n" +
    "import a from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "z;\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
