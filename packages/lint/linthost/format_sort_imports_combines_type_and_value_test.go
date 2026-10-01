package linthost

import "testing"

// TestFormatSortImportsCombinesTypeAndValue verifies combineTypeAndValue folds
// a type-only import into a value import of the same module.
//
// With the option on, the type-only specifiers move into the value declaration
// as inline `type` specifiers (ordered after the value specifiers); the merged
// declaration is no longer type-only.
//
//  1. Parse a value import and a type-only import of the same module.
//  2. Enable combineTypeAndValue and unsafe runtime sorting.
//  3. Assert one declaration with the value specifier before the inline `type`.
//
// @evidence contracts/testing.md#behavioral-verification Both enabled options must merge foo and type-only Bar into one foo,type Bar import while retaining foo use.
// @evidence contracts/testing.md#independent-expectations The public combine contract preserves Bar as an inline type import and foo as a value binding. The complete literal output fixes that distinction independently of bucket construction.
// @evidence contracts/testing.md#distinguishing-cases Both options are enabled, contrasting combine-only abstention and unsafe-without-combine separation. Type-only default protection is owned by separate hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsCombinesTypeAndValue owns the literal mixed-type/value transformation and both explicit options in the selected public Go unit population. The owning syntax rule and fixture observations execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsCombinesTypeAndValue(t *testing.T) {
  source := "import { foo } from \"m\";\n" +
    "import type { Bar } from \"m\";\n" +
    "foo;\n"
  expected := "import { foo, type Bar } from \"m\";\n" +
    "foo;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true,"unsafeSortRuntimeImports":true}`, expected)
}
