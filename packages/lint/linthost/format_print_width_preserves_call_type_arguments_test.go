package linthost

import "testing"

// TestFormatPrintWidthPreservesCallTypeArguments verifies a call
// expression with type arguments (`foo<A>(…)`) keeps its
// `<A>` segment on reflow.
//
// Type arguments live in a node-list distinct from the value
// arguments, and the CallExpression printer emits them via a
// verbatim slice. A regression that swapped the order, dropped the
// segment, or duplicated it would corrupt the call's contract with the
// TypeScript-Go type checker on the next pass.
//
//  1. Configure printWidth=24.
//  2. Feed `foo<Alpha>(aaaaaa, bbbbbb, cccccc);` — the call breaks
//     because its flat form is ~35 chars wide.
//  3. Assert `<Alpha>` survives in the output.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the preserves call type arguments fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert `<Alpha>` survives in the output.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=24. The asserted decision is: Assert `<Alpha>` survives in the output. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesCallTypeArguments is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthPreservesCallTypeArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "foo<Alpha>(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 24}`,
    "foo<Alpha>(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
