package linthost

import "testing"

// TestFormatPrintWidthPreservesOptionalCallToken verifies a call
// expression with the optional-chain `?.` token (`foo?.(a, b)`)
// keeps the marker on reflow.
//
// The token sits between the callee and the open paren of the
// argument list. The CallExpression printer emits it via a verbatim
// slice; a regression that elided the token would silently convert
// `foo?.()` into `foo()` and change runtime semantics (the optional
// short-circuit on a nullish callee would disappear).
//
//  1. Configure printWidth=20.
//  2. Feed `foo?.(aaaaaa, bbbbbb, cccccc);` so the call must break.
//  3. Assert the `?.` token survives between the callee and the
//     argument list.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the preserves optional call token fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the `?.` token survives between the callee and the argument list.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=20. The asserted decision is: Assert the `?.` token survives between the callee and the argument list. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesOptionalCallToken is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthPreservesOptionalCallToken(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "foo?.(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 20}`,
    "foo?.(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
