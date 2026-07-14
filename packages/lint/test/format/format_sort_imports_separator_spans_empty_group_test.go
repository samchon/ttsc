package linthost

import "testing"

// TestFormatSortImportsSeparatorSpansEmptyGroup verifies a blank-line separator
// still appears when the group it guards produced no imports.
//
// With order [third-party, "", @api, "", relative] and no `@api/*` import, the
// transition from third-party straight to relative must still collapse to a
// single blank line carried by the skipped middle group.
//
//  1. Parse a third-party and a relative import (no @api import).
//  2. Apply that order with unsafe runtime sorting enabled.
//  3. Assert one blank line separates the two populated groups.
func TestFormatSortImportsSeparatorSpansEmptyGroup(t *testing.T) {
  source := "import { a } from \"alpha\";\n" +
    "import { b } from \"./local\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a } from \"alpha\";\n" +
    "\n" +
    "import { b } from \"./local\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<THIRD_PARTY_MODULES>","","@api/(.*)","","^[.]"],"unsafeSortRuntimeImports":true}`, expected)
}
