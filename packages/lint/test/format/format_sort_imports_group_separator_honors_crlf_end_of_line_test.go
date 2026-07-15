package linthost

import "testing"

// TestFormatSortImportsGroupSeparatorHonorsCRLFEndOfLine verifies the blank
// line between import groups is two CRLF terminators under endOfLine:"crlf".
//
// Regression shield for issue #616 on the group-separator path: the block
// builder emitted a hard-coded "\n\n" between groups, so the blank line dropped
// two lone LFs into an otherwise-CRLF file. Bound to the CRLF oracle (LF twin:
// format_sort_imports_separator_spans_empty_group_test.go); the helper asserts
// zero lone LFs, which specifically pins that BOTH newlines of the blank line
// are "\r\n".
//
//  1. Parse a CRLF file with one third-party and one relative import.
//  2. Apply an order that separates the two populated groups with a blank line
//     under {"endOfLine":"crlf"}.
//  3. Assert the blank line is "\r\n\r\n" and no lone LF remains.
func TestFormatSortImportsGroupSeparatorHonorsCRLFEndOfLine(t *testing.T) {
  source := "import { a } from \"alpha\";\r\n" +
    "import { b } from \"./local\";\r\n" +
    "a;\r\n" +
    "b;\r\n"
  expected := "import { a } from \"alpha\";\r\n" +
    "\r\n" +
    "import { b } from \"./local\";\r\n" +
    "a;\r\n" +
    "b;\r\n"
  assertFixCRLFConsistentWithOptions(
    t,
    "format/sort-imports",
    source,
    `{"order":["<THIRD_PARTY_MODULES>","","@api/(.*)","","^[.]"],"unsafeSortRuntimeImports":true,"endOfLine":"crlf"}`,
    expected,
  )
}
