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
func TestFormatSortImportsSortsErasedTypeOnlyBlock(t *testing.T) {
  source := "import type { Zebra } from \"zebra\";\n" +
    "import type { Alpha } from \"alpha\";\n"
  expected := "import type { Alpha } from \"alpha\";\n" +
    "import type { Zebra } from \"zebra\";\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
