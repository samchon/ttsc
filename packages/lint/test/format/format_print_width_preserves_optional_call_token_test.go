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
func TestFormatPrintWidthPreservesOptionalCallToken(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "foo?.(aaaaaa, bbbbbb, cccccc);\n",
    `{"printWidth": 20}`,
    "foo?.(\n  aaaaaa,\n  bbbbbb,\n  cccccc,\n);\n",
  )
}
