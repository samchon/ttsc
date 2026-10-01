package linthost

import "testing"

// TestCommandFormatBlankLineInList covers Prettier's preservation of a single
// source blank line between items of an object literal, a call argument list,
// and a broken array. A blank line forces the list broken; without a blank the
// list reflows normally (no spurious blank). All sources are Prettier-canonical.
//
//  1. Exercise the authored command format blank line in list fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command at printWidth 70 over five authored lists: blank lines kept in an object, a call argument list and a broken array, a short object without blank staying flat, and three blank lines collapsing to one.
// @evidence contracts/testing.md#independent-expectations Sources and the single collapsed expectation are authored literals following the stated rule that one source blank line between list items is preserved and runs collapse to one; nothing is derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases Positives (blank preserved in object, call args, array), a negative (no blank stays flat) and a changing case (three blank lines become one) are distinguished; the only transformation case is the collapse, the rest are fixed points.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via the assertFormat helpers; no child process, built binary or installed consumer.
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
