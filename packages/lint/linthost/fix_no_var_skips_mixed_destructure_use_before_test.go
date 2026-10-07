package linthost

import "testing"

// TestFixNoVarSkipsMixedDestructureUseBefore verifies no-var reports but does
// not rewrite a mixed declaration list whose destructured sibling is read
// before the declaration line.
//
// `var a = 1, { b } = o;` binds a plain `a` and a destructured `b` under one
// `var` keyword. The list contains two declarators, so the single-declarator
// gate refuses it before any one-target reference scan. A prior `f(b);`
// reads `b` above its own declaration, which
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
// @evidence contracts/testing.md#distinguishing-cases A destructured sibling carries the hazard even when plain a is safe; a function-local counterpart removes independent script-global refusal.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsMixedDestructureUseBefore calls assertNoFixSnapshot on both original and function-local prefixed mixed lists.
func TestFixNoVarSkipsMixedDestructureUseBefore(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "f(b);\nvar a = 1, { b } = o;\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nf(b);\nvar a = 1, { b } = o;\n}\n",
  )
}
