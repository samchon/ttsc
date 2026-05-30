package linthost

import "testing"

// TestFormatSortImportsCombinesTypeAndValue verifies combineTypeAndValue folds
// a type-only import into a value import of the same module.
//
// With the option on, the type-only specifiers move into the value declaration
// as inline `type` specifiers; the merged declaration is no longer type-only.
//
//  1. Parse a value import and a type-only import of the same module.
//  2. Apply the rule with combineTypeAndValue enabled.
//  3. Assert one declaration with an inline `type` specifier.
func TestFormatSortImportsCombinesTypeAndValue(t *testing.T) {
	source := "import { foo } from \"m\";\n" +
		"import type { Bar } from \"m\";\n" +
		"foo;\n"
	expected := "import { type Bar, foo } from \"m\";\n" +
		"foo;\n"
	assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"combineTypeAndValue":true}`, expected)
}
