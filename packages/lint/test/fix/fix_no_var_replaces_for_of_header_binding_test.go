package linthost

import "testing"

// TestFixNoVarReplacesForOfHeaderBinding verifies no-var rewrites a safe
// `for (var item of …)` header to `let`.
//
// A `for...of` header `var` with no initializer, no reference in the head
// expression, and no closure capture receives each element in a fresh `let`
// binding with the same observable sequence as the shared `var` binding, so
// the rewrite must fire (issue #409).
//
//  1. Parse a `for...of` statement declaring `var item` and reading it in the
//     body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesForOfHeaderBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (var item of [1, 2]) {\n  JSON.stringify(item);\n}\n",
    "for (let item of [1, 2]) {\n  JSON.stringify(item);\n}\n",
  )
}
