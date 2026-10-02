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
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on three callbacks whose bodies are braceless `for-of`, braceless `if`, and `if` with a braced consequent plus braceless `else`, and requires each unchanged.
// @evidence contracts/testing.md#independent-expectations The three sources are authored literals in the layout Prettier keeps for braceless bodies and serve as their own expected output; nothing is derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases Three negative (fixed-point) cases: a rule that expanded braceless bodies or re-indented them to the block-depth model would change them. No input that must change is included, so a formatter that never touches control flow also passes.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each source calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatLeavesABracelessControlFlowBodyAlone(t *testing.T) {
  for _, source := range []string{
    "run(() => {\n  for (const x of xs) f(x);\n});\n",
    "run(() => {\n  if (n) f(n);\n});\n",
    "run(() => {\n  if (n) {\n    f(n);\n  } else g(n);\n});\n",
  } {
    assertFormatUnchanged(t, source)
  }
}
