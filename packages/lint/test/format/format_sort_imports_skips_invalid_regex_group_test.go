package linthost

import "testing"

// TestFormatSortImportsSkipsInvalidRegexGroup verifies an uncompilable regex
// entry in `order` is skipped rather than crashing the run.
//
// A bad pattern (`[`) is dropped; remaining groups still apply and unmatched
// specifiers fall through to the appended third-party catch-all.
//
//  1. Parse a third-party and a relative import.
//  2. Apply the rule with order ["[", "^[.]"] (the first entry is invalid).
//  3. Assert the relative group still leads and no crash occurs.
func TestFormatSortImportsSkipsInvalidRegexGroup(t *testing.T) {
  source := "import { a } from \"alpha\";\n" +
    "import { b } from \"./local\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { b } from \"./local\";\n" +
    "import { a } from \"alpha\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["[","^[.]"]}`, expected)
}
