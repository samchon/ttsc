package linthost

import "testing"

// TestFormatSortImportsGroupSeparatorHonorsCRLFEndOfLine verifies the blank
// line between import groups is two CRLF terminators under endOfLine:"crlf".
//
// The expected blank group separator contains two CRLF pairs; emitting
// a hard-coded "\n\n" instead would introduce two lone LFs. The LF twin is
// format_sort_imports_separator_spans_empty_group_test.go. The helper asserts
// zero lone LFs, which specifically pins that BOTH newlines of the blank line
// are "\r\n".
//
//  1. Parse a CRLF file with one third-party and one relative import.
//  2. Apply an order that separates the two populated groups with a blank line
//     under {"endOfLine":"crlf"}.
//  3. Assert the blank line is "\r\n\r\n" and no lone LF remains.
//
// @evidence contracts/testing.md#behavioral-verification The alpha and relative imports must gain exactly a CRLF/CRLF blank separator, preserve all uses and contain no lone LF.
// @evidence contracts/testing.md#independent-expectations The explicit crlf option requires each synthesized group line ending to be CRLF. The literal full-output and independent lone-LF check distinguish mixed-ending corruption.
// @evidence contracts/testing.md#distinguishing-cases The middle api group is empty but its separator still applies. The LF empty-group twin and ordinary CRLF join host distinguish separator and declaration joins.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsGroupSeparatorHonorsCRLFEndOfLine owns the authored CRLF group-separator fixture, complete output and lone-LF assertion in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
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
