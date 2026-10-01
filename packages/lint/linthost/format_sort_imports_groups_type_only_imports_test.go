package linthost

import "testing"

// TestFormatSortImportsGroupsTypeOnlyImports verifies a <TYPES> group hoists
// `import type` declarations ahead of value imports.
//
// The placeholder matches type-only declarations regardless of specifier, so a
// `<TYPES>` group placed first pulls every `import type` to the top.
//
//  1. Parse a value import and a type-only import.
//  2. Apply that order with unsafe runtime sorting enabled.
//  3. Assert the type-only import sorts first.
//
// @evidence contracts/testing.md#behavioral-verification An explicit leading TYPES group must move type-only B from n ahead of value a from m without combining them or changing a use.
// @evidence contracts/testing.md#independent-expectations The supported TYPES placeholder matches clause-level type-only imports regardless of module spelling. The literal output independently preserves the type/value phases and declared group order.
// @evidence contracts/testing.md#distinguishing-cases Both type and value groups are populated with different modules. The regex-scoped TYPES host supplies matched and unmatched type imports; inline-type runtime protection is separate.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsGroupsTypeOnlyImports owns the literal mixed-phase custom-group transformation and unsafe permission in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsGroupsTypeOnlyImports(t *testing.T) {
  source := "import { a } from \"m\";\n" +
    "import type { B } from \"n\";\n" +
    "a;\n"
  expected := "import type { B } from \"n\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>","<THIRD_PARTY_MODULES>"],"unsafeSortRuntimeImports":true}`, expected)
}
