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
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises keeps empty expression nested block and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require every source to survive byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Put an empty block in callback, object-member, function, and array slots. The asserted decision is: Require every source to survive byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatKeepsEmptyExpressionNestedBlock owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
