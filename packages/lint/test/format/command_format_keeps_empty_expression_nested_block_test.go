package linthost

import "testing"

// TestCommandFormatKeepsEmptyExpressionNestedBlock verifies the empty twin of
// #922 stays on one line in every covered expression position.
//
// The force-break predicate must inspect block contents. Treating every block
// in expression position as non-empty would expand `{}` into a shape Prettier
// never emits.
//
//  1. Put an empty block in callback, object-member, function, and array slots.
//  2. Run `ttsc format`.
//  3. Require every source to survive byte-identical.
func TestCommandFormatKeepsEmptyExpressionNestedBlock(t *testing.T) {
  for _, source := range []string{
    "run(() => {});\n",
    "export const o = { m() {} };\n",
    "run(function () {});\n",
    "export const fns = [() => {}];\n",
  } {
    assertFormatUnchanged(t, source)
  }
}
