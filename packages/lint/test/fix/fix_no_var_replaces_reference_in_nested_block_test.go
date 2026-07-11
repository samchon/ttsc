package linthost

import "testing"

// TestFixNoVarReplacesReferenceInNestedBlock verifies no-var still rewrites a
// `var` referenced from a block nested WITHIN the declaring block.
//
// The escape check is positional containment in the declaring block's span,
// not same-block equality: an inner block's reference still sees the `let`
// binding, so it must not trigger a decline. This pins the boundary between
// "deeper inside" (fixable) and "after the block" (declined).
//
//  1. Parse a block declaring `var x` with the read inside a nested block.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesReferenceInNestedBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "{\n  var x = 1;\n  {\n    JSON.stringify(x);\n  }\n}\n",
    "{\n  let x = 1;\n  {\n    JSON.stringify(x);\n  }\n}\n",
  )
}
