package linthost

import "testing"

// TestFormatSortImportsMergesDefaultAndNamed verifies a default import and a
// named import of the same module merge into one declaration.
//
// The default binding survives alongside the union of named specifiers.
//
//  1. Parse a file importing `{ b }` and a default from the same module.
//  2. Apply the rule with default options.
//  3. Assert one merged `default, { named }` declaration.
func TestFormatSortImportsMergesDefaultAndNamed(t *testing.T) {
  source := "import { b } from \"m\";\n" +
    "import a from \"m\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import a, { b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshot(t, "format/sort-imports", source, expected)
}
