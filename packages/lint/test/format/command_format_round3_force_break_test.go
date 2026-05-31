package linthost

import "testing"

// TestCommandFormatRound3ForceBreak covers the round-3 fix to the print-width
// fast path: a force-breaking node nested inside an otherwise-fitting call/new
// (an array `shouldBreak`, or a function-composition `new`) must still explode,
// and the BigInt array must NOT fill. Each `assertFormatResult` feeds a FLAT
// (fits-80) source and asserts the prettier-canonical broken output, exercising
// the flat -> broken reflow direction the existing suite never covered.
func TestCommandFormatRound3ForceBreak(t *testing.T) {
  // A same-kind array-of-arrays nested in `new Map([...])` force-breaks even
  // though the flat form fits (the fast path used to skip the outer `new`).
  t.Run("array_of_arrays_in_new_map_breaks_from_flat", func(t *testing.T) {
    assertFormatResult(t,
      "const b = new Map([[\"a\", 1], [\"b\", 2]]);\n",
      "const b = new Map([\n  [\"a\", 1],\n  [\"b\", 2],\n]);\n")
  })
  // Same shape nested in a plain call argument.
  t.Run("array_of_arrays_in_call_breaks_from_flat", func(t *testing.T) {
    assertFormatResult(t,
      "foo([[1, 2], [3, 4]]);\n",
      "foo([\n  [1, 2],\n  [3, 4],\n]);\n")
  })
  // Function composition on a NEW expression explodes (callForcesFunctionBreak
  // now covers NewExpression).
  t.Run("function_composition_new_breaks_from_flat", func(t *testing.T) {
    assertFormatResult(t,
      "new Foo(() => a, () => b);\n",
      "new Foo(\n  () => a,\n  () => b,\n);\n")
  })
  // A BigInt array is NOT concisely printed (Prettier's isNumericLiteral
  // excludes BigInt), so an overflowing one explodes one element per line
  // rather than filling several per line.
  t.Run("bigint_array_one_per_line", func(t *testing.T) {
    assertFormatResult(t,
      "const x = [11111111111n, 22222222222n, 33333333333n, 44444444444n, 55555555555n];\n",
      "const x = [\n  11111111111n,\n  22222222222n,\n  33333333333n,\n  44444444444n,\n  55555555555n,\n];\n")
  })
}
