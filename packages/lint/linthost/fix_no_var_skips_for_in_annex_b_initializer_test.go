package linthost

import "testing"

// TestFixNoVarSkipsForInAnnexBInitializer verifies no-var reports but does
// not rewrite an Annex-B `for (var i = 0 in …)` header.
//
// Annex B tolerates an initializer on a `for...in` declarator with `var`;
// the identical header with `let` is a SyntaxError in every mode. The
// keyword rewrite would therefore turn parseable (if legacy) source into a
// file that no longer compiles, so the initializer check must decline while
// the diagnostic still fires (issue #409).
//
// 1. Parse a `for...in` header whose `var i` declarator carries `= 0`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
//
// @evidence contracts/testing.md#behavioral-verification no-var diagnoses but preserves an Annex-B for-in var initializer.
// @evidence contracts/testing.md#independent-expectations The original for (var i = 0 in ...) and zero edits avoid the illegal corresponding let initializer grammar.
// @evidence contracts/testing.md#distinguishing-cases An initialized legacy for-in header differs from the uninitialized safe for-in positive case; this test concerns parser-level rule behavior.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsForInAnnexBInitializer executes assertNoFixSnapshot with the literal Annex-B header.
func TestFixNoVarSkipsForInAnnexBInitializer(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var i = 0 in { a: 1 }) {\n  JSON.stringify(i);\n}\n",
  )
}
