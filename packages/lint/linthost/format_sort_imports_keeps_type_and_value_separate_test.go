package linthost

import "testing"

// TestFormatSortImportsKeepsTypeAndValueSeparate verifies that without
// combineTypeAndValue a value import and a type-only import of the same module
// stay distinct declarations.
//
// The two have different merge keys by default, so they are grouped and sorted
// but never folded together.
//
//  1. Parse a value import and a type-only import of the same module plus a
//     later-sorting third-party import.
//  2. Apply the rule with unsafe runtime sorting enabled.
//  3. Assert the value and type-only imports remain separate.
//
// @evidence contracts/testing.md#behavioral-verification Unsafe sorting without combine must move m before z while retaining separate value foo and type Bar declarations plus foo use.
// @evidence contracts/testing.md#independent-expectations The supported default keeps type and value declarations distinct. The literal whole-file output independently preserves binding phases while specifying permitted module order.
// @evidence contracts/testing.md#distinguishing-cases Runtime sorting is allowed but combining is absent; the combine-enabled host is the adjacent merge positive and combine-only host is the runtime-permission negative.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsKeepsTypeAndValueSeparate owns the literal full-output sorted-but-uncombined mixed import fixture in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsKeepsTypeAndValueSeparate(t *testing.T) {
  source := "import { z } from \"z\";\n" +
    "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "import { z } from \"z\";\n" +
    "foo;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"unsafeSortRuntimeImports":true}`, expected)
}
