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
//
// @evidence contracts/testing.md#behavioral-verification Safe defaults must change the first list to alpha,zebra while keeping b before a as dependency declaration order and retaining the complete console use.
// @evidence contracts/testing.md#independent-expectations The public safe contract permits local named-specifier sorting without runtime declaration movement. Literal whole-file output independently distinguishes these two orderings and retains binding meaning.
// @evidence contracts/testing.md#distinguishing-cases A runtime block is reverse lexical by module and its first named list is reverse lexical by binding. The output changes only the safe list, contrasting unsafe whole-block reordering and comment protection.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsSortsNamedSpecifiersWithoutReorderingRuntimeImports owns its literal mixed-runtime source and complete local-list-only expected edit in the selected public Go unit population. Parsing, owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsSortsNamedSpecifiersWithoutReorderingRuntimeImports(t *testing.T) {
  source := "import { zebra, alpha } from \"./b\";\n" +
    "import value from \"./a\";\n" +
    "console.log(alpha, zebra, value);\n"
  expected := "import { alpha, zebra } from \"./b\";\n" +
    "import value from \"./a\";\n" +
    "console.log(alpha, zebra, value);\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
