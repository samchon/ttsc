package linthost

import "testing"

// TestCommandFormatNumericArrayFill covers Prettier's concise "fill" layout
// for arrays. An array of more than one numeric literal packs as many elements
// per line as fit; a string or identifier array stays one-per-line; a short
// numeric array stays flat; a single-element array never fills. All sources are
// Prettier-3-canonical at printWidth 60, so format must keep them byte-identical.
func TestCommandFormatNumericArrayFill(t *testing.T) {
  pw := map[string]any{"printWidth": 60}
  t.Run("numeric_array_fills", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const codes = [
  79, 98, 106, 101, 99, 116, 70, 105, 108, 101, 83, 121,
  115, 116, 101, 109, 80,
];
`, pw)
  })
  t.Run("signed_numeric_array_fills", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const signed = [
  -1, 2, -33, 44, -555, 66, -7, 88, -9, 100, -111, 22, -3,
  4444, -5, 66, -777,
];
`, pw)
  })
  // negatives: string / identifier arrays do NOT fill — one per line.
  t.Run("string_array_one_per_line", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const names = [
  "alphaValue",
  "betaValueHere",
  "gammaValue",
  "deltaValueLong",
  "epsilonV",
];
`, pw)
  })
  t.Run("identifier_array_one_per_line", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const mixed = [
  someIdentifier,
  anotherIdentifierHere,
  thirdIdentifierValue,
  fourthIdentifierV,
];
`, pw)
  })
  // short numeric array fits flat; single element never fills.
  t.Run("small_numeric_array_flat", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, "const small = [1, 2, 3];\n", pw)
  })
  t.Run("single_numeric_array_flat", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, "const one = [123456789];\n", pw)
  })
  // a flat numeric array that overflows must reflow to the packed fill form.
  t.Run("numeric_array_flat_reflows_to_fill", func(t *testing.T) {
    assertFormatResultWithFormat(t,
      "const codes = [79, 98, 106, 101, 99, 116, 70, 105, 108, 101, 83, 121, 115, 116, 101, 109, 80];\n",
      `const codes = [
  79, 98, 106, 101, 99, 116, 70, 105, 108, 101, 83, 121,
  115, 116, 101, 109, 80,
];
`, pw)
  })
}
