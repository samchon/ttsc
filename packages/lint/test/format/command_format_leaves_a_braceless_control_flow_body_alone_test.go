package linthost

import "testing"

// TestCommandFormatLeavesABracelessControlFlowBodyAlone is the negative twin
// for the structured control-flow printers.
//
// Prettier keeps a braceless body on its header's terms, and `format/indent`
// cedes such a body entirely (`cededUnderBracelessBody`) because the
// block-depth model has no frame for its extra indentation level. Dispatching
// only the nested expression would put the two rules in disagreement.
//
//  1. Put braceless loop and if bodies inside a callback.
//  2. Run `ttsc format`.
//  3. Require the source to survive byte-identical.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises leaves a braceless control flow body alone and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite. The owned result is: Require the source to survive byte-identical.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Put braceless loop and if bodies inside a callback. The asserted decision is: Require the source to survive byte-identical. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatLeavesABracelessControlFlowBodyAlone owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatLeavesABracelessControlFlowBodyAlone(t *testing.T) {
  for _, source := range []string{
    "run(() => {\n  for (const x of xs) f(x);\n});\n",
    "run(() => {\n  if (n) f(n);\n});\n",
    "run(() => {\n  if (n) {\n    f(n);\n  } else g(n);\n});\n",
  } {
    assertFormatUnchanged(t, source)
  }
}
