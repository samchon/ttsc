package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksTypeParamDefaultAfterEquals verifies a
// type parameter whose `extends C = Default` overflows breaks after `=`,
// hanging the default one level deeper, matching Prettier 3.
//
// This is the print-width symptom the benchmark flagged as the
// type-parameter-default divergence: ttsc left the over-width line
// verbatim; Prettier breaks at `=`.
//
//  1. Parse a class with one long defaulted type parameter (printWidth 50).
//  2. Apply format/declaration-header.
//  3. Assert the default hangs on the next line and the list explodes.
func TestFormatDeclarationHeaderBreaksTypeParamDefaultAfterEquals(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class E<TVeryLongTypeParam extends SomeConstraint = DefaultType> {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "class E<\n  TVeryLongTypeParam extends SomeConstraint =\n    DefaultType,\n> {\n  a = 1;\n}\n",
  )
}
