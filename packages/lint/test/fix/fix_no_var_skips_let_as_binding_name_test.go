package linthost

import "testing"

// TestFixNoVarSkipsLetAsBindingName verifies no-var declines the fix for a
// binding literally named `let`.
//
// `var let = 1;` parses in sloppy scripts, but `let let = 1;` is a
// SyntaxError in every mode, so the keyword rewrite would corrupt the source
// outright. Same class as the single-statement-position decline: the output
// must stay parseable, mirroring upstream ESLint no-var's
// DISALLOWED_LET_NAMES (`let`, `static`).
//
//  1. Parse a file declaring `var let = 1` and reading it afterwards.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsLetAsBindingName(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "var let = 1;\nJSON.stringify(let);\n",
  )
}
