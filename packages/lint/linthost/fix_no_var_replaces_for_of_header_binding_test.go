package linthost

import "testing"

// TestFixNoVarReplacesForOfHeaderBinding verifies no-var rewrites a safe
// `for (var item of …)` header to `let`.
//
// This module fixture has no initializer or iterable self-reference, and
// its only item read is directly inside the body. No closure, direct eval
// or post-loop read observes the binding, so fresh `let` bindings preserve
// the body's element sequence and the rewrite must fire (issue #409).
//
//  1. Parse a `for...of` statement declaring `var item` and reading it in the
//     body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes the item binding in a safe for-of header.
// @evidence contracts/testing.md#independent-expectations Literal for-let output preserves the [1, 2] iterable and direct item read.
// @evidence contracts/testing.md#distinguishing-cases No iterable self-reference or body closure exists; both unsafe variants have companion no-fix tests.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesForOfHeaderBinding calls assertFixSnapshot for no-var on the item loop source.
func TestFixNoVarReplacesForOfHeaderBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (var item of [1, 2]) {\n  JSON.stringify(item);\n}\nexport {};\n",
    "for (let item of [1, 2]) {\n  JSON.stringify(item);\n}\nexport {};\n",
  )
}
