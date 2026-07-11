package linthost

import "testing"

// TestFixNoVarSkipsBlockScopeEscape verifies no-var reports but does not
// rewrite a `var` declared inside a block and referenced after the block.
//
// `var` hoists to the enclosing function/global scope, so a read after the
// declaring block sees the binding; `let` is block-scoped, so the same read
// stops compiling (TS2304 / ReferenceError). The safety gate declines when any
// value reference lies outside the declaring statement's enclosing block-scope
// node's span (issue #364: this shape used to be rewritten and broke the
// compile).
//
//  1. Parse a file declaring `var x` inside an if-block and reading `x` after it.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsBlockScopeEscape(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "if (Math.random() > 0.5) {\n  var x = 1;\n}\nJSON.stringify(x);\n",
  )
}
