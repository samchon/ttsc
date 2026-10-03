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
//
// @evidence contracts/testing.md#behavioral-verification no-var reports but keeps the unbraced if-body var declaration.
// @evidence contracts/testing.md#independent-expectations The original source and zero edits avoid the illegal if-body lexical declaration grammar.
// @evidence contracts/testing.md#distinguishing-cases An unbraced slot differs from a proper block, SourceFile or namespace container; a function-local counterpart removes independent script-global refusal.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarSkipsSingleStatementPosition invokes assertNoFixSnapshot for both original and function-local bare if-body fixtures.
func TestFixNoVarSkipsSingleStatementPosition(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "no-var",
    "if (Math.random() > 0.5) var x = 1;\n",
  )
  assertNoFixSnapshot(
    t,
    "no-var",
    "function noVarFixture(){\nif (Math.random() > 0.5) var x = 1;\n}\n",
  )
}
