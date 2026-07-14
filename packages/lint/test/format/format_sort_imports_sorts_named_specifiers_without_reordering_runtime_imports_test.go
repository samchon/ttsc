package linthost

import "testing"

// TestFormatSortImportsSortsNamedSpecifiersWithoutReorderingRuntimeImports
// verifies safe local formatting remains active inside a protected value block.
//
// The runtime guard applies only to declaration-level reconstruction. Named
// specifier order has no effect on dependency evaluation, so the rule should
// still fix `{ zebra, alpha }` without moving its declaration across a sibling.
//
//  1. Parse reverse-lexical runtime declarations and one unsorted named list.
//  2. Apply format/sort-imports with safe defaults.
//  3. Assert only the named list changes and declaration order remains intact.
func TestFormatSortImportsSortsNamedSpecifiersWithoutReorderingRuntimeImports(t *testing.T) {
  source := "import { zebra, alpha } from \"./b\";\n" +
    "import value from \"./a\";\n" +
    "console.log(alpha, zebra, value);\n"
  expected := "import { alpha, zebra } from \"./b\";\n" +
    "import value from \"./a\";\n" +
    "console.log(alpha, zebra, value);\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
