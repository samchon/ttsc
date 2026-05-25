package linthost

import "testing"

// TestFormatPrintWidthSkipsNamespaceImportShape verifies the rule
// passes through `import * as ns from "x"` declarations untouched.
//
// Namespace imports have no internal reflow surface — the `* as ns`
// clause is a single specifier, not a comma-separated list. The
// ImportDeclaration printer detects this shape and returns verbatim;
// the case asserts the rule does not act on it regardless of width.
//
//  1. Configure printWidth=10.
//  2. Feed `import * as someVeryLongNamespaceAlias from "x";`.
//  3. Assert the rule reports zero findings.
func TestFormatPrintWidthSkipsNamespaceImportShape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "import * as someVeryLongNamespaceAlias from \"x\";\n",
    `{"printWidth": 10}`,
  )
}
