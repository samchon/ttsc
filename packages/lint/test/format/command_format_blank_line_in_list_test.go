package linthost

import "testing"

// TestCommandFormatBlankLineInList covers Prettier's preservation of a single
// source blank line between items of an object literal, a call argument list,
// and a broken array. A blank line forces the list broken; without a blank the
// list reflows normally (no spurious blank). All sources are Prettier-canonical.
func TestCommandFormatBlankLineInList(t *testing.T) {
  pw := map[string]any{"printWidth": 70}
  t.Run("object_blank_preserved", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const obj = {
  firstKey: valueOne,

  secondKey: valueTwo,
};
`, pw)
  })
  t.Run("call_arg_blank_preserved", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `foo(
  argumentOne,

  argumentTwoValue,
);
`, pw)
  })
  t.Run("broken_array_blank_preserved", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const arr = [
  elementOneValueHereThatIsLongEnoughToForceTheArrayToBreakAcrossLines,

  elementTwoValue,
];
`, pw)
  })
  // negative: no blank line -> a short object stays flat (no spurious break).
  t.Run("object_no_blank_flat", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, "const o = { a: 1, b: 2 };\n", pw)
  })
  // two or more blank lines collapse to a single one.
  t.Run("multiple_blanks_collapse_to_one", func(t *testing.T) {
    assertFormatResultWithFormat(t,
      `const obj = {
  firstKey: valueOne,



  secondKey: valueTwo,
};
`,
      `const obj = {
  firstKey: valueOne,

  secondKey: valueTwo,
};
`, pw)
  })
}
