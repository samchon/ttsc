package linthost

import "testing"

// TestFixNoVarReplacesReferenceInsideWithBody verifies no-var still rewrites
// a `var` declared outside a `with` statement but referenced inside its body.
//
// Negative twin of the with-body decline: this initialized function binding
// is declared before and outside the with statement. Its later body read
// still passes through the same dynamic object environment after the rewrite;
// no earlier read, direct eval or global property observes the binding.
//
//  1. Parse a function-local `var x` read from inside a with body.
//  2. Apply the no-var finding's text edit through the disk-backed fixer.
//  3. Assert only the `var` keyword changed to `let`.
//
// A sloppy function owns the binding so the with statement remains valid and var has no global-object property.
//
// @evidence contracts/testing.md#behavioral-verification no-var fixes x declared before with even though the with body reads x.
// @evidence contracts/testing.md#independent-expectations Literal let x output preserves the with statement and read; the declaration remains outside the dynamic object environment.
// @evidence contracts/testing.md#distinguishing-cases Declaration location distinguishes this safe arm from TestFixNoVarSkipsWithStatementBody, where the declaration is inside with.
// @evidence contracts/testing.md#execution-ownership TestFixNoVarReplacesReferenceInsideWithBody invokes assertFixSnapshot on the outer-x/inner-with source.
func TestFixNoVarReplacesReferenceInsideWithBody(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-var",
    "function f(){\nconst o = {};\nvar x = 1;\nwith (o) {\n  JSON.stringify(x);\n}\n}\n",
    "function f(){\nconst o = {};\nlet x = 1;\nwith (o) {\n  JSON.stringify(x);\n}\n}\n",
  )
}
