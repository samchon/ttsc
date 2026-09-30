package linthost

import "testing"

// TestFormatSortImportsHonorsCRLFEndOfLine verifies the rebuilt import block
// joins declarations with CRLF under endOfLine:"crlf".
//
// Regression shield for issue #616: buildSortedImportBlock joined declarations
// with a hard-coded "\n", so re-sorting an otherwise-CRLF import block injected
// lone LFs. The rule now accepts endOfLine (threaded from the top-level format
// key by config_format.go). Bound to the CRLF oracle (LF twin: format_sort_
// imports_groups_external_before_relative_test.go); the helper asserts zero
// lone LFs.
//
//  1. Parse a CRLF file with shuffled third-party and relative imports.
//  2. Apply format/sort-imports with {"endOfLine":"crlf"}.
//  3. Assert the declarations join with "\r\n" and no lone LF remains.
//
// @evidence contracts/testing.md#behavioral-verification Sorting must retain CRLF in all rebuilt joins and the unchanged body while producing alpha,zebra,local-a,local-b with zero lone LF.
// @evidence contracts/testing.md#independent-expectations The explicit crlf option requires synthesized declaration joins to use CRLF. Whole-file literal order and lone-LF scanning independently detect content and line-ending errors.
// @evidence contracts/testing.md#distinguishing-cases Four shuffled imports occupy two adjacent groups without blank separators. The CRLF group-separator peer verifies the separate two-ending join and the LF twin owns default joins.
// @evidence contracts/testing.md#execution-ownership TestFormatSortImportsHonorsCRLFEndOfLine owns the authored CRLF four-import snapshot and independent lone-LF observation in the selected public Go unit population. Owning syntax rule and fixture edits execute in one Go process without native builds, consumer installation or real product-host children.
func TestFormatSortImportsHonorsCRLFEndOfLine(t *testing.T) {
  source := "import { reduce } from \"./local-b\";\r\n" +
    "import zebra from \"zebra\";\r\n" +
    "import { x } from \"./local-a\";\r\n" +
    "import alpha from \"alpha\";\r\n" +
    "JSON.stringify({ reduce, zebra, x, alpha });\r\n"
  expected := "import alpha from \"alpha\";\r\n" +
    "import zebra from \"zebra\";\r\n" +
    "import { x } from \"./local-a\";\r\n" +
    "import { reduce } from \"./local-b\";\r\n" +
    "JSON.stringify({ reduce, zebra, x, alpha });\r\n"
  assertFixCRLFConsistentWithOptions(
    t,
    "format/sort-imports",
    source,
    `{"unsafeSortRuntimeImports":true,"endOfLine":"crlf"}`,
    expected,
  )
}
