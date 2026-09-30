package linthost

import "testing"

// TestCommandFormatBlankLineInList covers Prettier's preservation of a single
// source blank line between items of an object literal, a call argument list,
// and a broken array. A blank line forces the list broken; without a blank the
// list reflows normally (no spurious blank). All sources are Prettier-canonical.
//
//  1. Exercise the authored command format blank line in list fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises blank line in list and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: object_blank_preserved, call_arg_blank_preserved, broken_array_blank_preserved, object_no_blank_flat, multiple_blanks_collapse_to_one. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatBlankLineInList owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
