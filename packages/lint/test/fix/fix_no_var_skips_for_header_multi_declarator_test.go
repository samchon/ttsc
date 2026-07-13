package linthost

import "testing"

// TestFixNoVarSkipsForHeaderMultiDeclarator verifies no-var reports once but
// does not rewrite a multi-declarator `for (var i = 0, limit = 3; …)` header.
//
// A declaration list shares one keyword across all of its declarators, so
// the token-scoped rewrite would re-scope every binding at once; the gate
// only reasons about a single plain identifier declarator and must decline
// the compound header while still emitting exactly one diagnostic for the
// one list (issue #409).
//
// 1. Parse a `for` header declaring `var i = 0, limit = 3`.
// 2. Run the no-var fixer through the disk-backed applier.
// 3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsForHeaderMultiDeclarator(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "for (var i = 0, limit = 3; i < limit; i += 1) {\n  JSON.stringify(i);\n}\n",
  )
}
