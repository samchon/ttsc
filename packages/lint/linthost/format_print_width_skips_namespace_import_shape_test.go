package linthost

import "testing"

// TestFormatPrintWidthSkipsNamespaceImportShape verifies the rule
// passes through `import * as ns from "x"` declarations untouched.
//
// Namespace imports have no internal reflow surface — the `* as ns`
// clause is a single specifier, not a comma-separated list. The
// ImportDeclaration printer detects this shape and returns verbatim;
// the case asserts the rule does not act on this shape at width 10.
//
//  1. Configure printWidth=10.
//  2. Feed `import * as someVeryLongNamespaceAlias from "x";`.
//  3. Assert the rule reports zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The rule must report no findings for a namespace import whose single alias exceeds width 10. The zero-findings assertion forbids inserting a break into its indivisible star-as clause.
// @evidence contracts/testing.md#independent-expectations The authored unchanged input fixes the supported namespace-import boundary at width 10. Its star-as binding has no comma-delimited member surface; print width does not permit changing the identifier or import syntax.
// @evidence contracts/testing.md#distinguishing-cases This negative distinguishes an overflowing but indivisible namespace import from TestFormatPrintWidthBreaksDefaultPlusNamedImportShape at the same width. It owns this syntax-shape boundary rather than a general claim about every budget.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthSkipsNamespaceImportShape parses its literal source and invokes the same-process registered rule via assertRuleSkipsSourceWithOptions. It is a selected public Go unit without install, native build or real-host children.
func TestFormatPrintWidthSkipsNamespaceImportShape(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "import * as someVeryLongNamespaceAlias from \"x\";\n",
    `{"printWidth": 10}`,
  )
}
