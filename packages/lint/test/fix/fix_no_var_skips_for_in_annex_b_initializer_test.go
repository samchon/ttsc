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
func TestFixNoVarSkipsForInAnnexBInitializer(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var i = 0 in { a: 1 }) {\n  JSON.stringify(i);\n}\n",
  )
}
