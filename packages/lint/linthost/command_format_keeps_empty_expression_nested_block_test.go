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
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on four one-line sources with an empty block in expression position (arrow callback, object method, function expression, array-element arrow) and requires each unchanged.
// @evidence contracts/testing.md#independent-expectations The four sources are authored literals that serve as their own expected output, following from the Prettier rule that an empty block stays on one line.
// @evidence contracts/testing.md#distinguishing-cases Four negative cases, the empty twins of the expansion test; a formatter that expanded every expression-position block would break them. Fixed points only, so they cannot show the non-empty expansion.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each source calls run with the format subcommand on a temp-dir project via assertFormatUnchanged (a loop without subtests); no child process, built binary or installed consumer.
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
