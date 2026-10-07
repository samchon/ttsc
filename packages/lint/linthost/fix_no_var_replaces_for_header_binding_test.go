package linthost

import "testing"

// TestFixNoVarReplacesForHeaderBinding verifies no-var rewrites a safe
// `for (var i = …)` header to `let`.
//
// Loop-header `var` lists reach the rule through KindVariableDeclarationList
// (issue #409). This initialized header has a unique binding, direct reads
// only inside the loop and no closure or direct eval observation. Its
// per-iteration let binding carries the update forward, preserving this
// fixture's iteration behavior, so the keyword rewrite must fire.
//
// 1. Parse a `for` statement declaring `var i` and reading it directly.
// 2. Apply the no-var finding's text edit through the disk-backed fixer.
// 3. Assert only the `var` keyword changed to `let`.
//
// An explicit module owns the binding; var does not create a global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var rewrites a unique for-header i to let while retaining the loop condition, increment and body.
// @evidence contracts/testing.md#independent-expectations The complete literal for-let result preserves the direct iteration reads independently of the fixer.
// @evidence contracts/testing.md#distinguishing-cases Only in-loop direct uses occur; closure capture, post-loop read and multi-declarator headers have separate no-fix cases.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesForHeaderBinding calls assertFixSnapshot for the i header and applies its actual rule edits in process.
func TestFixNoVarReplacesForHeaderBinding(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "for (var i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\nexport {};\n",
    "for (let i = 0; i < 3; i += 1) {\n  JSON.stringify(i);\n}\nexport {};\n",
  )
}
