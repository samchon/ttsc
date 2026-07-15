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
