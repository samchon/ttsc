package linthost

import "testing"

// TestFixNoVarReplacesForInHeaderBinding verifies no-var rewrites a safe
// `for (var key in …)` header to `let`.
//
// A `for...in` header `var` with no initializer, no reference in the head
// expression, and no closure capture assigns each key to a fresh `let`
// binding with the same observable sequence as the shared `var` binding, so
// the rewrite must fire (issue #409).
//
//  1. Parse a `for...in` statement declaring `var key` and reading it in the
//     body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesForInHeaderBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (var key in { a: 1 }) {\n  JSON.stringify(key);\n}\n",
    "for (let key in { a: 1 }) {\n  JSON.stringify(key);\n}\n",
  )
}
