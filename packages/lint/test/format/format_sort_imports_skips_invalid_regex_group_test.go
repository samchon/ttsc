package linthost

import "testing"

// TestFormatSortImportsSkipsInvalidRegexGroup verifies an uncompilable regex
// entry in `order` is skipped rather than crashing the run.
//
// A bad pattern (`[`) is dropped; the remaining `^[.]` group still applies and
// the third-party catch-all (injected at the front when omitted) takes the
// unmatched specifier.
//
//  1. Parse a third-party and a relative import.
//  2. Apply the rule with order ["[", "^[.]"] (the first entry is invalid).
//  3. Assert the run continues and groups by the surviving order.
func TestFormatSortImportsSkipsInvalidRegexGroup(t *testing.T) {
  source := "import { b } from \"./local\";\n" +
    "import { a } from \"alpha\";\n" +
    "a;\n" +
    "b;\n"
  expected := "import { a } from \"alpha\";\n" +
    "import { b } from \"./local\";\n" +
    "a;\n" +
    "b;\n"
  assertFixSnapshotWithOptions(t, "format/sort-imports", source, `{"order":["[","^[.]"]}`, expected)
}
