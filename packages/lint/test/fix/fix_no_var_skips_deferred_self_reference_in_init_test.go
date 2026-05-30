package linthost

import "testing"

// TestFixNoVarSkipsDeferredSelfReferenceInInit documents the INTENTIONAL
// conservative over-decline for a deferred self-reference inside the
// initializer.
//
// `var f = () => f;` is actually safe to rewrite to `let f = () => f;`: the
// inner `f` read happens only when the returned arrow is later called, long
// after `f` is initialized, so no TDZ error occurs. Distinguishing this
// deferred read from an executes-during-init read (`var x = (() => x)();`)
// would require tracking whether the enclosing function/arrow is invoked during
// initialization, which the AST-local gate deliberately does not attempt.
//
// Per the rule's conservative posture (over-declining is always safe; the goal
// is to end the TDZ whack-a-mole), the gate declines on ANY value reference to
// the target within the declarator's initializer range. This test pins that
// chosen behavior: the diagnostic fires but the safe-to-fix `var f = () => f;`
// is left as `var`. Over-declining never corrupts source.
//
//  1. Parse `var f = () => f;`, a deferred self-read inside a nested arrow.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied
//     (conservative over-decline).
func TestFixNoVarSkipsDeferredSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var f = () => f;\n",
  )
}
