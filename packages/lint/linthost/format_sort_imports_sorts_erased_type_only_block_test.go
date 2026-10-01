package linthost

import "testing"

// TestFormatSortImportsSortsErasedTypeOnlyBlock verifies the safe default still
// orders declarations when every import is erased before runtime evaluation.
//
// Blocking every declaration-level operation would protect runtime semantics
// but discard safe formatter value. An all-`import type` block has no module
// evaluation order to preserve, so it remains eligible for grouping and sort.
//
//  1. Parse two type-only imports in reverse lexical order.
//  2. Apply format/sort-imports without unsafe options.
//  3. Assert the erased declarations sort alphabetically.
//
// @evidence contracts/testing.md#behavioral-verification Safe default sorting must place erased Alpha before Zebra while preserving both clause-level type-only bindings.
// @evidence contracts/testing.md#independent-expectations The official TypeScript module contract erases import type declarations, so they add no runtime dependency ordering. The literal output independently fixes alphabetical order and preserves type-only form.
// @evidence contracts/testing.md#distinguishing-cases All declarations are erased and unsafe permission is absent. Runtime and inline-type blocks stay protected in separate hosts, and same-module type-only merging supplies another safe positive.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSortsErasedTypeOnlyBlock owns its literal erased-type source and complete default-options sorted output in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsSortsErasedTypeOnlyBlock(t *testing.T) {
  source := "import type { Zebra } from \"zebra\";\n" +
    "import type { Alpha } from \"alpha\";\n"
  expected := "import type { Alpha } from \"alpha\";\n" +
    "import type { Zebra } from \"zebra\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
