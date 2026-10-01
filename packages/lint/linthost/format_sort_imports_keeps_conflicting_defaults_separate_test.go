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
//
// @evidence contracts/testing.md#behavioral-verification Both default b and default a imports from m must survive separately in original equal-module order while moving before z and preserving all uses.
// @evidence contracts/testing.md#independent-expectations Each distinct default name is an accessible local binding. The authored full output refuses name loss under supported conflict handling while independently fixing module order.
// @evidence contracts/testing.md#distinguishing-cases Two distinct defaults cannot occupy one merged default slot. The compatible default-plus-named peer supplies its merge positive; byte-identical namespace duplicates exercise a different protection.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsConflictingDefaultsSeparate owns its literal conflicting-default source, full output and explicit unsafe options in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
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
