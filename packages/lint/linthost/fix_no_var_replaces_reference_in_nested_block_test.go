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
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes block-local x read within a deeper nested block.
// @evidence contracts/testing.md#independent-expectations The full literal let source preserves both block pairs and the nested read, which stays within the declaring block.
// @evidence contracts/testing.md#distinguishing-cases Nested-inside references are safe; references after the block are independently rejected by TestFixNoVarSkipsBlockScopeEscape.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesReferenceInNestedBlock calls assertFixSnapshot on its two-level block fixture.
func TestFixNoVarReplacesReferenceInNestedBlock(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "{\n  var x = 1;\n  {\n    JSON.stringify(x);\n  }\n}\nexport {};\n",
    "{\n  let x = 1;\n  {\n    JSON.stringify(x);\n  }\n}\nexport {};\n",
  )
}
