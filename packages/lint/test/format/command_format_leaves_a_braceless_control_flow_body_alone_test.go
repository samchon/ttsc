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
func TestCommandFormatLeavesABracelessControlFlowBodyAlone(t *testing.T) {
  for _, source := range []string{
    "run(() => {\n  for (const x of xs) f(x);\n});\n",
    "run(() => {\n  if (n) f(n);\n});\n",
    "run(() => {\n  if (n) {\n    f(n);\n  } else g(n);\n});\n",
  } {
    assertFormatUnchanged(t, source)
  }
}
