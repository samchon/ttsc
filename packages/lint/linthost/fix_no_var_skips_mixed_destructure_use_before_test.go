package linthost

import "testing"

// TestFixNoVarSkipsMixedDestructureUseBefore verifies no-var reports but does
// not rewrite a mixed declaration list whose destructured sibling is read
// before the declaration line.
//
// `var a = 1, { b } = o;` binds a plain `a` and a destructured `b` under one
// `var` keyword. The binding-name helper skips destructuring, so the
// use-before-declaration scan never sees `b` and the single-plain-binding
// guard passes. A prior `f(b);` reads `b` above its own declaration, which
// `var` hoisting tolerates but `let` turns into a TDZ ReferenceError. The
// declaration-count guard declines because the list holds two
// VariableDeclaration nodes, so the diagnostic still fires but no edit lands.
//
//  1. Parse a file that reads `b` before a mixed plain+destructure list.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var preserves a mixed a/{b} list when b is read before it.
// @evidence contracts/testing.md#independent-expectations The literal f(b) prefix and original source identity require zero edits, preserving the forward var read.
// @evidence contracts/testing.md#distinguishing-cases A destructured sibling carries the hazard even when the plain a binding is safe.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsMixedDestructureUseBefore calls assertNoFixSnapshot on the prefixed mixed list.
func TestFixNoVarSkipsMixedDestructureUseBefore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "f(b);\nvar a = 1, { b } = o;\n",
  )
}
