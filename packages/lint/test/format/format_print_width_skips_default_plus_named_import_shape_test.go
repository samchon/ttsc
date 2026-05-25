package linthost

import "testing"

// TestFormatPrintWidthSkipsDefaultPlusNamedImportShape verifies the
// rule does NOT touch `import D, { … } from "x"` declarations.
//
// The ImportDeclaration printer recognizes `import D, { … }` as an
// uncovered shape and returns verbatim. The integration safety net is
// the "no diff → no edit" comparison: if the printer produces the
// same bytes as the source, no edit is emitted even when the input is
// long. The case feeds a deliberately wide combined-import shape and
// asserts the rule emits zero findings — the partial-coverage v1 must
// not strip the default specifier.
//
//  1. Configure printWidth=10 (any reflow attempt would fire).
//  2. Feed `import D, { alpha, bravo, charlie } from "x";`.
//  3. Assert the rule emits zero findings.
func TestFormatPrintWidthSkipsDefaultPlusNamedImportShape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "import D, { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 10}`,
  )
}
