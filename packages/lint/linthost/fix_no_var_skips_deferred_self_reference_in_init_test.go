package linthost

import "testing"

// TestFixNoVarSkipsDeferredSelfReferenceInInit documents the INTENTIONAL
// conservative over-decline for a deferred self-reference inside the
// initializer.
//
// Inside the function counterpart, `var f = () => f;` can become `let`: the
// inner `f` read happens only when the returned arrow is later called, long
// after `f` is initialized, so no TDZ error occurs. Distinguishing this
// deferred read from an executes-during-init read (`var x = (() => x)();`)
// would require tracking whether the enclosing function/arrow is invoked during
// initialization, which the AST-local gate deliberately does not attempt.
//
// Per the rule's conservative posture (over-declining is always safe; the goal
// is to end the TDZ whack-a-mole), the gate declines on ANY value reference to
// the target within the declarator's initializer range. This test pins that
// chosen local behavior: the diagnostic fires but `var f = () => f;`
// is left as `var`. Over-declining never corrupts source.
//
//  1. Parse `var f = () => f;`, a deferred self-read inside a nested arrow.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied
//     (conservative over-decline).
//
// The original script is retained. A sloppy-function counterpart runs the
// same body so global-object binding exposure cannot mask this named guard.
//
// @evidence contracts/testing.md#behavioral-verification no-var reports var f = () => f while conservatively withholding its function-local lexical rewrite; the original script independently preserves global-object exposure.
// @evidence contracts/testing.md#independent-expectations The original f closure and zero applied fixes specify the supported initializer-reference policy, not an assertion of runtime unsafety.
// @evidence contracts/testing.md#distinguishing-cases Deferred self-reference differs semantically from immediate self-reference, but both intentionally share the conservative gate.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsDeferredSelfReferenceInInit calls assertNoFixSnapshot on its one-line f initializer.
func TestFixNoVarSkipsDeferredSelfReferenceInInit(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var f = () => f;\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nvar f = () => f;\n}\n",
  )
}
