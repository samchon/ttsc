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
//
// @evidence contracts/testing.md#behavioral-verification Unsafe sorting with default comparison must put apple before React while preserving case in each module/binding and all original use bytes.
// @evidence contracts/testing.md#independent-expectations The documented case-insensitive default orders the literal apple key before react. Authored complete output keeps original spelling rather than regenerating strings from the sorter.
// @evidence contracts/testing.md#distinguishing-cases Uppercase React and lowercase apple reverse order under raw comparison; the case-sensitive twin asserts that alternate option. Both use explicit runtime permission.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsOrdersCaseInsensitivelyByDefault owns the authored mixed-case complete-output transformation and default comparison option in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
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
