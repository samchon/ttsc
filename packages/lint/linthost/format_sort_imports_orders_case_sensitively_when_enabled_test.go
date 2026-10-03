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
//
// @evidence contracts/testing.md#behavioral-verification Explicit case-sensitive unsafe sorting must put React before apple and preserve all module, binding and use spelling.
// @evidence contracts/testing.md#independent-expectations The public caseSensitive option uses raw ordering; R precedes a in ASCII. The authored literal output independently fixes that order without case-folding the preserved payload.
// @evidence contracts/testing.md#distinguishing-cases The same mixed-case pair appears with reversed expectation in the default-comparison twin. This positive isolates the option from runtime permission, which is also explicitly enabled.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsOrdersCaseSensitivelyWhenEnabled owns the authored mixed-case complete-output transformation with both explicit options in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
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
