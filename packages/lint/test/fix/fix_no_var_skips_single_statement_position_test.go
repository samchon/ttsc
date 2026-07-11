package linthost

import "testing"

// TestFixNoVarSkipsSingleStatementPosition verifies no-var declines the fix
// for a `var` that is an unbraced statement body.
//
// A lexical declaration is grammatically illegal as a single-statement body:
// `if (c) let x = 1;` is a SyntaxError, so the keyword rewrite would corrupt
// the source outright. The gate requires the statement's parent to be a
// block-scope container (Block / ModuleBlock / switch clause / SourceFile)
// before any reference is even examined (issue #364).
//
//  1. Parse `if (…) var x = 1;` — the var statement is the bare if-body.
//  2. Run the no-var fixer through the disk-backed applier.
//  3. Assert at least one finding fired but zero fixes were applied.
func TestFixNoVarSkipsSingleStatementPosition(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "if (Math.random() > 0.5) var x = 1;\n",
  )
}
