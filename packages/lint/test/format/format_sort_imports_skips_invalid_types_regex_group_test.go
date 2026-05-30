package linthost

import "testing"

// TestFormatSortImportsSkipsInvalidTypesRegexGroup verifies an uncompilable
// regex attached to a <TYPES> entry is skipped rather than crashing the run.
//
// `<TYPES>[` carries a bad trailing pattern; the group is dropped and the run
// proceeds with the remaining groups (here merging duplicate modules).
//
//  1. Parse two value imports of the same module.
//  2. Apply the rule with order ["<TYPES>[", "<THIRD_PARTY_MODULES>"].
//  3. Assert the run merges the duplicates without crashing.
func TestFormatSortImportsSkipsInvalidTypesRegexGroup(t *testing.T) {
  source := "import { b } from \"m\";\n" +
    "import { a } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a, b } from \"m\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["<TYPES>[","<THIRD_PARTY_MODULES>"]}`, expected)
}
