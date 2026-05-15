package main

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
func TestFormatPrintWidthPreservesCallTypeArguments(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "foo<Alpha>(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 24}`,
    "foo<Alpha>(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
