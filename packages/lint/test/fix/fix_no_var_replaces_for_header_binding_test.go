package linthost

import "testing"

// TestFixNoVarReplacesForHeaderBinding verifies no-var rewrites a safe
// `for (var i = …)` header to `let`.
//
// Loop-header `var` lists reach the rule through KindVariableDeclarationList
// (issue #409). A header binding that is unique file-wide, referenced only
// inside the loop's own span, and never captured by a closure behaves
// identically under `let` (the per-iteration copy carries body mutations
// forward exactly like the shared `var`), so the keyword rewrite must fire.
//
// 1. Parse a `for` statement declaring `var i` and reading it directly.
// 2. Apply the no-var finding's text edit through the disk-backed fixer.
// 3. Assert only the `var` keyword changed to `let`.
func TestFixNoVarReplacesForHeaderBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\n",
    "for (let i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\n",
  )
}
